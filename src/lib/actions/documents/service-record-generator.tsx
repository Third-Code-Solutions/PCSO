/**
 * Service Record Generator
 * PRD PIM-012 / TOR 1.3.8 — Serial number SR-YYYY-NNNNNN
 *
 * Generates the CSC Service Record document with:
 * - PCSO letterhead (from orgProfile)
 * - Employee heading (name, employee no., birth date, present position, office)
 * - Chronological service history reconstructed from appointments, step
 *   increments, and salary adjustments (buildServiceHistory)
 * - Honest current-state fallback when no appointment history exists
 * - Configurable certifier title (FM signatory chain via getPayrollSignatories)
 * - Serial number from the centralized serial sequence system (PIM-016)
 */

"use server";

import { db } from "@/lib/db";
import {
  employees,
  orgProfile,
  offices,
  appointments,
  stepIncrements,
  salaryAdjustments,
} from "@/lib/db/schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  generateSerialNumber,
  DOCUMENT_TYPES,
} from "@/lib/db/serial-sequence-helpers";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { pdf } from "@react-pdf/renderer";
import { createServerClient } from "@/lib/supabase/server";
import { ServiceRecordPdf } from "@/components/pdf/service-record";
import { buildServiceHistory } from "@/lib/utils/documents/service-history";
import { getPayrollSignatories } from "@/lib/utils/payroll/signatories";
import { getEffectiveMonthlySalary } from "@/lib/utils/payroll/salary";
import type { AppointmentType } from "@/lib/utils/payroll/types";

interface GenerateServiceRecordParams {
  employeeId: string;
  requestedBy?: string; // Employee ID of requester (for audit)
}

interface GenerateServiceRecordResult {
  success: boolean;
  serialNumber?: string;
  documentUrl?: string;
  error?: string;
}

/**
 * Resolve a monthly basic salary from the SSL/CPCS schedule. Returns null on
 * any out-of-range value so a single malformed record never aborts the whole
 * document — the affected row simply renders "—".
 */
function resolveMonthlySalary(
  appointmentType: AppointmentType,
  salaryGrade: number,
  step: number,
): number | null {
  try {
    return getEffectiveMonthlySalary(appointmentType, salaryGrade, step);
  } catch {
    return null;
  }
}

export async function generateServiceRecord(
  params: GenerateServiceRecordParams,
): Promise<GenerateServiceRecordResult> {
  try {
    // Service Record issuance is an HR-side operation (document requests route
    // through processDocumentRequest, which carries the same permission).
    const user = await requirePermission("employees", "process");

    // 1. Fetch employee data (+ office)
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, params.employeeId),
      with: {
        office: true,
      },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    // 2. Fetch org profile
    const org = await db.query.orgProfile.findFirst();
    if (!org) {
      return { success: false, error: "Organization profile not configured" };
    }

    const officeName = employee.office?.name ?? null;

    // 3. Load the raw service history inputs the reconstruction needs.
    const [apptRows, incRows, adjRows] = await Promise.all([
      db
        .select({
          effectivityDate: appointments.effectivityDate,
          endDate: appointments.endDate,
          positionTitle: appointments.positionTitle,
          appointmentType: appointments.appointmentType,
          monthlySalary: appointments.monthlySalary,
          officeName: offices.name,
        })
        .from(appointments)
        .leftJoin(offices, eq(appointments.officeId, offices.id))
        .where(
          and(
            eq(appointments.employeeId, params.employeeId),
            inArray(appointments.status, ["active", "expired", "superseded"]),
          ),
        )
        .orderBy(asc(appointments.effectivityDate)),
      db
        .select({
          effectivityDate: stepIncrements.effectivityDate,
          fromStep: stepIncrements.fromStep,
          toStep: stepIncrements.toStep,
        })
        .from(stepIncrements)
        .where(
          and(
            eq(stepIncrements.employeeId, params.employeeId),
            eq(stepIncrements.status, "implemented"),
          ),
        )
        .orderBy(asc(stepIncrements.effectivityDate)),
      db
        .select({
          effectiveDate: salaryAdjustments.effectiveDate,
          adjustmentType: salaryAdjustments.adjustmentType,
          newSalary: salaryAdjustments.newSalary,
        })
        .from(salaryAdjustments)
        .where(
          and(
            eq(salaryAdjustments.employeeId, params.employeeId),
            eq(salaryAdjustments.status, "effected"),
            isNull(salaryAdjustments.deletedAt),
          ),
        )
        .orderBy(asc(salaryAdjustments.effectiveDate)),
    ]);

    // 4. Build the chronological service history rows.
    const rows = buildServiceHistory({
      employee: {
        positionTitle: employee.positionTitle,
        appointmentType: employee.appointmentType,
        dateHired: employee.dateHired,
        monthlySalary: resolveMonthlySalary(
          employee.appointmentType,
          employee.salaryGrade,
          employee.step,
        ),
        officeName,
        status: employee.status,
        // No separation-date column on employees — final period stays "Present".
      },
      appointments: apptRows.map((a) => ({
        effectivityDate: a.effectivityDate,
        endDate: a.endDate,
        positionTitle: a.positionTitle,
        appointmentType: a.appointmentType,
        monthlySalary: a.monthlySalary != null ? Number(a.monthlySalary) : null,
        officeName: a.officeName,
      })),
      stepIncrements: incRows.map((s) => ({
        effectivityDate: s.effectivityDate,
        fromStep: s.fromStep,
        toStep: s.toStep,
        monthlySalary: resolveMonthlySalary(
          employee.appointmentType,
          employee.salaryGrade,
          s.toStep,
        ),
      })),
      salaryAdjustments: adjRows.map((a) => ({
        effectiveDate: a.effectiveDate,
        adjustmentType: a.adjustmentType,
        newSalary: a.newSalary != null ? Number(a.newSalary) : null,
      })),
    });

    // 5. Resolve the certifier title from the FM signatory chain (fallback: COA
    //    default chain). The signature NAME is a placeholder, mirroring the COE.
    const signatories = await getPayrollSignatories("SERVICE_RECORD");
    const certifier =
      signatories.find((s) => s.role.trim().toLowerCase() === "certified_by") ??
      signatories[0];
    const issuedByTitle = certifier?.title ?? "HRD Manager";

    // 6. Generate serial number (atomic)
    const serialNumber = await generateSerialNumber(
      DOCUMENT_TYPES.SERVICE_RECORD,
    );

    const issuedDate = new Date().toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // 7. Render the PDF blob.
    const blob = await pdf(
      <ServiceRecordPdf
        serialNumber={serialNumber}
        agencyName={org.agencyName}
        agencyAddress={org.agencyAddress}
        branchLabel={org.agencyShortName}
        employee={{
          lastName: employee.lastName,
          firstName: employee.firstName,
          middleName: employee.middleName,
          suffix: employee.suffix,
          employeeNo: employee.employeeNo,
          birthDate: employee.birthDate,
          positionTitle: employee.positionTitle,
          officeName,
        }}
        rows={rows}
        isCurrentStateFallback={apptRows.length === 0}
        issuedDate={issuedDate}
        issuedByName="[AUTHORIZED SIGNATORY NAME]"
        issuedByTitle={issuedByTitle}
      />,
    ).toBlob();

    // 8. Upload to Supabase Storage
    const supabase = await createServerClient();
    const filePath = `service-record/${serialNumber}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, blob, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Failed to upload Service Record to storage:", uploadError);
      return {
        success: false,
        error: "Failed to save document to storage",
      };
    }

    // 9. Get public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(filePath);

    // 10. Log issuance in the audit trail (PIM-016 serial issuance logging)
    await auditLog({
      userId: user.id,
      action: "document.service_record.issue",
      table: "serial_sequences",
      newValues: {
        serialNumber,
        documentType: "SERVICE_RECORD",
        employeeId: employee.id,
        employeeNo: employee.employeeNo,
        issuedById: user.employeeId ?? user.id,
        requestedBy: params.requestedBy ?? null,
        documentUrl: urlData.publicUrl,
      },
    });

    return {
      success: true,
      serialNumber,
      documentUrl: urlData.publicUrl,
    };
  } catch (error) {
    console.error("Service Record generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
