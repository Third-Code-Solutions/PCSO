"use server";

/**
 * RPM APPOINTMENT server actions.
 *
 * CLAUDE.md §4.2.4 (RPM-022..025), §12.3 (atomic provisioning at APPOINTED
 * state). Issues the 5 appointment-package PDFs and auto-provisions the new
 * employee inside a single DB transaction.
 *
 * PDF generation is INTENTIONALLY outside the transaction. The DB commit is
 * the source of truth; if PDF rendering or storage upload fails, we log
 * the failure per-document and let callers regenerate later. A broken
 * uploader must NEVER roll back the employee.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";

import { db } from "@/lib/db";
import { withTx, type Tx } from "@/lib/db/transaction";
import { offices, plantillaPositions, employees } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server";
import {
  atomicallyProvisionNewEmployee,
  type AppointmentIssueInput,
  type AutoProvisionResult,
} from "@/lib/utils/rpm/auto-provision";
import { CscAppointmentPdf } from "@/components/pdf/csc-appointment";
import { OathOfOfficePdf } from "@/components/pdf/oath-of-office";
import { AssumptionDutyPdf } from "@/components/pdf/assumption-duty";
import { PositionDescriptionPdf } from "@/components/pdf/position-description";
import { AtafPdf } from "@/components/pdf/ataf";

// ─── Input schema ─────────────────────────────────────────────────────────────

const openingLeaveSchema = z.object({
  leaveTypeCode: z.string().min(1),
  totalCredits: z.string(),
  usedCredits: z.string().optional(),
  carryOver: z.string().optional(),
});

const applicantPersonalInfoSchema = z.object({
  firstName: z.string().min(1),
  middleName: z.string().nullish(),
  lastName: z.string().min(1),
  suffix: z.string().nullish(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(["male", "female", "prefer_not_to_say"]),
  civilStatus: z.enum([
    "single",
    "married",
    "widowed",
    "legally_separated",
    "annulled",
  ]),
  nationality: z.string().optional(),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  tin: z.string().nullish(),
  gsisNo: z.string().nullish(),
  philhealthNo: z.string().nullish(),
  pagibigNo: z.string().nullish(),
});

// Internal to this 'use server' module — must not be exported (Next.js
// server-action modules may only export async functions).
const appointmentIssueSchema = z.object({
  applicationId: z.string().uuid(),
  positionId: z.string().uuid(),
  officeId: z.string().uuid(),
  itemNumber: z.string().min(1),
  positionTitle: z.string().min(1),
  salaryGrade: z.number().int().min(1).max(33),
  stepIncrement: z.number().int().min(1).max(8),
  appointmentType: z.enum([
    "permanent",
    "temporary",
    "coterminous",
    "casual",
    "job_order",
    "contract_of_service",
  ]),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monthlySalary: z.string(),
  appointingAuthorityEmployeeId: z.string().uuid(),
  appointingAuthorityName: z.string().min(1),
  appointingAuthorityRole: z.string().min(1),
  officeHeadEmployeeId: z.string().uuid().optional(),
  officeHeadName: z.string().min(1),
  officeHeadRole: z.string().min(1),
  administeringOfficerName: z.string().min(1),
  administeringOfficerRole: z.string().min(1),
  witnessName: z.string().nullish(),
  witnessRole: z.string().nullish(),
  duties: z.array(z.string().min(1)).min(1),
  qualifications: z.object({
    education: z.string(),
    training: z.string(),
    experience: z.string(),
    eligibility: z.string(),
    competencies: z.string().optional(),
  }),
  reportsTo: z.string().min(1),
  openingLeaveBalances: z.array(openingLeaveSchema).optional(),
  workScheduleId: z.string().uuid().optional(),
  applicant: applicantPersonalInfoSchema,
  natureOfMovement: z
    .enum(["new_appointment", "transfer", "detail", "reassignment"])
    .default("new_appointment"),
});

export type AppointmentIssueRequest = z.infer<typeof appointmentIssueSchema>;

// ─── Serial number helpers (reuses serial_sequences) ─────────────────────────

type AppointmentDocKind = "APT" | "OATH" | "ADO" | "PDF" | "ATAF";

interface SequenceRow {
  last_sequence: number;
}

async function nextAppointmentSerial(
  tx: Tx,
  kind: AppointmentDocKind,
  year: number,
): Promise<string> {
  const docType = `appointment_${kind.toLowerCase()}`;
  await tx.execute(sql`
    insert into public.serial_sequences (document_type, year, last_sequence)
    values (${docType}, ${year}, 0)
    on conflict (document_type, year) do nothing
  `);
  const rows = (await tx.execute(sql`
    update public.serial_sequences
      set last_sequence = last_sequence + 1,
          updated_at = now()
      where document_type = ${docType} and year = ${year}
      returning last_sequence
  `)) as unknown as SequenceRow[];
  const first = rows[0];
  if (!first) {
    throw new Error(`Failed to allocate ${kind} serial for year=${year}`);
  }
  return `${kind}-${year}-${first.last_sequence.toString().padStart(6, "0")}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppointmentDocumentStatus {
  documentType: AppointmentDocKind;
  serialNumber: string;
  storagePath: string | null;
  publicUrl: string | null;
  status: "generated" | "failed";
  error?: string;
}

export interface AppointmentIssueResult {
  provision: AutoProvisionResult;
  documents: AppointmentDocumentStatus[];
}

// ─── Main action: issueAppointment ────────────────────────────────────────────

export async function issueAppointment(
  input: unknown,
): Promise<AppointmentIssueResult> {
  const parsed = appointmentIssueSchema.parse(input);
  const user = await requirePermission("employees", "create");

  // ---- Step 1: atomic DB work (commits before any PDF I/O) ----
  const year = new Date(parsed.effectiveDate).getUTCFullYear();

  interface TxOut {
    provision: AutoProvisionResult;
    serials: Record<AppointmentDocKind, string>;
    officeName: string;
  }

  const txResult: TxOut = await withTx(async (tx) => {
    // Resolve office name for downstream PDFs.
    const [officeRow] = await tx
      .select({ name: offices.name })
      .from(offices)
      .where(eq(offices.id, parsed.officeId))
      .limit(1);
    const officeName = officeRow?.name ?? "N/A";

    const provisionInput: AppointmentIssueInput = {
      applicationId: parsed.applicationId,
      positionId: parsed.positionId,
      officeId: parsed.officeId,
      itemNumber: parsed.itemNumber,
      salaryGrade: parsed.salaryGrade,
      stepIncrement: parsed.stepIncrement,
      appointmentType: parsed.appointmentType,
      effectiveDate: parsed.effectiveDate,
      positionTitle: parsed.positionTitle,
      appointingAuthorityEmployeeId: parsed.appointingAuthorityEmployeeId,
      openingLeaveBalances: parsed.openingLeaveBalances,
      workScheduleId: parsed.workScheduleId,
      applicant: parsed.applicant,
      issuedByUserId: user.id,
    };

    const provision = await atomicallyProvisionNewEmployee(tx, provisionInput);

    const [apt, oath, ado, pdf, ataf] = await Promise.all([
      nextAppointmentSerial(tx, "APT", year),
      nextAppointmentSerial(tx, "OATH", year),
      nextAppointmentSerial(tx, "ADO", year),
      nextAppointmentSerial(tx, "PDF", year),
      nextAppointmentSerial(tx, "ATAF", year),
    ]);

    return {
      provision,
      officeName,
      serials: { APT: apt, OATH: oath, ADO: ado, PDF: pdf, ATAF: ataf },
    };
  });

  const { provision, officeName, serials } = txResult;
  const appointeeFullName = buildFullName(parsed.applicant);

  // ---- Step 2: render PDFs + upload (post-commit, best-effort) ----
  const pdfJobs: Array<{
    kind: AppointmentDocKind;
    serial: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @react-pdf types are module-scoped
    element: any;
  }> = [
    {
      kind: "APT",
      serial: serials.APT,
      element: CscAppointmentPdf({
        serialNumber: serials.APT,
        appointee: {
          fullName: appointeeFullName,
          employeeNo: provision.employeeNo,
        },
        positionTitle: parsed.positionTitle,
        itemNumber: parsed.itemNumber,
        salaryGrade: parsed.salaryGrade,
        step: parsed.stepIncrement,
        monthlySalary: parsed.monthlySalary,
        office: officeName,
        appointmentType: parsed.appointmentType,
        effectiveDate: parsed.effectiveDate,
        signatories: [
          {
            name: parsed.appointingAuthorityName,
            role: parsed.appointingAuthorityRole,
          },
        ],
      }),
    },
    {
      kind: "OATH",
      serial: serials.OATH,
      element: OathOfOfficePdf({
        serialNumber: serials.OATH,
        appointeeName: appointeeFullName,
        positionTitle: parsed.positionTitle,
        office: officeName,
        oathDate: parsed.effectiveDate,
        administeringOfficer: {
          name: parsed.administeringOfficerName,
          role: parsed.administeringOfficerRole,
        },
        witness:
          parsed.witnessName && parsed.witnessRole
            ? { name: parsed.witnessName, role: parsed.witnessRole }
            : undefined,
      }),
    },
    {
      kind: "ADO",
      serial: serials.ADO,
      element: AssumptionDutyPdf({
        serialNumber: serials.ADO,
        appointee: {
          fullName: appointeeFullName,
          employeeNo: provision.employeeNo,
          positionTitle: parsed.positionTitle,
          salaryGrade: parsed.salaryGrade,
          step: parsed.stepIncrement,
          office: officeName,
        },
        assumptionDate: parsed.effectiveDate,
        attestedBy: {
          name: parsed.officeHeadName,
          role: parsed.officeHeadRole,
        },
      }),
    },
    {
      kind: "PDF",
      serial: serials.PDF,
      element: PositionDescriptionPdf({
        serialNumber: serials.PDF,
        positionTitle: parsed.positionTitle,
        itemNumber: parsed.itemNumber,
        salaryGrade: parsed.salaryGrade,
        office: officeName,
        reportsTo: parsed.reportsTo,
        incumbent: appointeeFullName,
        duties: parsed.duties,
        qualifications: parsed.qualifications,
        signatories: [
          {
            name: parsed.appointingAuthorityName,
            role: parsed.appointingAuthorityRole,
          },
          {
            name: parsed.officeHeadName,
            role: parsed.officeHeadRole,
          },
        ],
      }),
    },
    {
      kind: "ATAF",
      serial: serials.ATAF,
      element: AtafPdf({
        serialNumber: serials.ATAF,
        appointee: {
          fullName: appointeeFullName,
          employeeNo: provision.employeeNo,
          positionTitle: parsed.positionTitle,
        },
        assignment: {
          office: officeName,
          effectiveDate: parsed.effectiveDate,
          natureOfMovement: parsed.natureOfMovement,
        },
        appointingAuthority: {
          name: parsed.appointingAuthorityName,
          role: parsed.appointingAuthorityRole,
        },
        officeHead: {
          name: parsed.officeHeadName,
          role: parsed.officeHeadRole,
        },
      }),
    },
  ];

  const supabase = await createServerClient();
  const bucket = "rpm-appointments";

  const documents: AppointmentDocumentStatus[] = [];
  for (const job of pdfJobs) {
    const storagePath = `${provision.employeeId}/${job.serial}.pdf`;
    try {
      const buffer = await renderToBuffer(job.element);
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (uploadError) throw new Error(uploadError.message);

      const { data: signedData, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
      if (signedError || !signedData) {
        throw new Error(signedError?.message ?? "signed-url missing");
      }
      documents.push({
        documentType: job.kind,
        serialNumber: job.serial,
        storagePath,
        publicUrl: signedData.signedUrl,
        status: "generated",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown error";
      console.error(
        `[appointment] PDF generation failed for ${job.kind} (${job.serial}):`,
        message,
      );
      documents.push({
        documentType: job.kind,
        serialNumber: job.serial,
        storagePath: null,
        publicUrl: null,
        status: "failed",
        error: message,
      });
    }
  }

  revalidatePath("/rpm");
  revalidatePath("/rpm/appointments");
  revalidatePath(`/employees/${provision.employeeId}`);

  return { provision, documents };
}

// ─── Read actions ─────────────────────────────────────────────────────────────

export interface AppointmentListItem {
  employeeId: string;
  employeeNo: string;
  fullName: string;
  positionTitle: string;
  appointmentType: string;
  dateHired: string;
  officeId: string | null;
}

/**
 * Lists recently-provisioned employees ordered by hire date desc.
 * Agent 01 will eventually replace this with a dedicated appointments table
 * query; for now we read back from `employees` which is the source of truth.
 */
export async function listAppointments(
  limit = 50,
): Promise<AppointmentListItem[]> {
  await requirePermission("employees", "view");
  const rows = await db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      middleName: employees.middleName,
      lastName: employees.lastName,
      suffix: employees.suffix,
      positionTitle: employees.positionTitle,
      appointmentType: employees.appointmentType,
      dateHired: employees.dateHired,
      officeId: employees.officeId,
    })
    .from(employees)
    .orderBy(sql`${employees.dateHired} desc`)
    .limit(limit);

  return rows.map((r) => ({
    employeeId: r.id,
    employeeNo: r.employeeNo,
    fullName: buildFullName({
      firstName: r.firstName,
      middleName: r.middleName ?? undefined,
      lastName: r.lastName,
      suffix: r.suffix ?? undefined,
    }),
    positionTitle: r.positionTitle,
    appointmentType: r.appointmentType,
    dateHired: r.dateHired,
    officeId: r.officeId,
  }));
}

export interface AppointmentDetail {
  employeeId: string;
  employeeNo: string;
  fullName: string;
  positionTitle: string;
  itemNumber: string | null;
  salaryGrade: number;
  step: number;
  appointmentType: string;
  dateHired: string;
  office: { id: string; name: string } | null;
}

export async function getAppointment(
  employeeId: string,
): Promise<AppointmentDetail | null> {
  await requirePermission("employees", "view");
  const [row] = await db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      middleName: employees.middleName,
      lastName: employees.lastName,
      suffix: employees.suffix,
      positionTitle: employees.positionTitle,
      salaryGrade: employees.salaryGrade,
      step: employees.step,
      appointmentType: employees.appointmentType,
      dateHired: employees.dateHired,
      officeId: employees.officeId,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!row) return null;

  let office: AppointmentDetail["office"] = null;
  if (row.officeId) {
    const [o] = await db
      .select({ id: offices.id, name: offices.name })
      .from(offices)
      .where(eq(offices.id, row.officeId))
      .limit(1);
    office = o ?? null;
  }

  let itemNumber: string | null = null;
  const [plantilla] = await db
    .select({ itemNo: plantillaPositions.itemNo })
    .from(plantillaPositions)
    .where(eq(plantillaPositions.employeeId, employeeId))
    .limit(1);
  if (plantilla) itemNumber = plantilla.itemNo;

  return {
    employeeId: row.id,
    employeeNo: row.employeeNo,
    fullName: buildFullName({
      firstName: row.firstName,
      middleName: row.middleName ?? undefined,
      lastName: row.lastName,
      suffix: row.suffix ?? undefined,
    }),
    positionTitle: row.positionTitle,
    itemNumber,
    salaryGrade: row.salaryGrade,
    step: row.step,
    appointmentType: row.appointmentType,
    dateHired: row.dateHired,
    office,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFullName(info: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  suffix?: string | null;
}): string {
  const parts = [
    info.firstName,
    info.middleName ?? "",
    info.lastName,
    info.suffix ?? "",
  ].filter((p) => p && p.trim().length > 0);
  return parts.join(" ");
}
