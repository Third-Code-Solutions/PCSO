/**
 * Personal Data Sheet (CS Form No. 212, Revised 2017) Generator
 * TOR 1.3.11 / PIM-013 — Serial number PDS-YYYY-NNNNNN
 *
 * Generates the official 4-page CSC Personal Data Sheet, auto-populated from
 * the employee 201 file where the schema holds data:
 *   I    Personal Information  → employees table
 *   V    Work Experience       → appointments history
 *   VII  Learning & Development → completed training participation
 *   VIII Other Information      → employees.special_skills_hobbies (Section 31)
 *
 * Sections without 201 backing yet (family, education, eligibility, voluntary
 * work, references) are rendered as blank official-form rows by the PDF
 * component itself — no data is passed or invented for them.
 */

"use server";

import { db } from "@/lib/db";
import {
  employees,
  orgProfile,
  appointments,
  trainingParticipants,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  generateSerialNumber,
  DOCUMENT_TYPES,
} from "@/lib/db/serial-sequence-helpers";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { pdf } from "@react-pdf/renderer";
import { createServerClient } from "@/lib/supabase/server";
import {
  PdsFormPdf,
  type PdsFormPdfProps,
  type PdsWorkExperienceRow,
  type PdsTrainingRow,
} from "@/components/pdf/pds-form";

interface GeneratePdsParams {
  employeeId: string;
  requestedBy?: string; // Employee ID of requester (for audit)
}

interface GeneratePdsResult {
  success: boolean;
  serialNumber?: string;
  documentUrl?: string;
  error?: string;
}

/** Humanize a snake_case enum value for the official-form face. */
function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Convert a Drizzle timestamp (Date) to an ISO date string (yyyy-mm-dd). */
function toIsoDate(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export async function generatePds(
  params: GeneratePdsParams,
): Promise<GeneratePdsResult> {
  try {
    // PDS issuance is an HR-side operation (document requests route through
    // processDocumentRequest, which carries the same permission).
    const user = await requirePermission("employees", "process");

    // 1. Fetch employee data
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

    // 3. Generate serial number (atomic)
    const serialNumber = await generateSerialNumber(DOCUMENT_TYPES.PDS);

    // 4. Section V — Work Experience (appointments history, recent first)
    const appointmentRows = await db.query.appointments.findMany({
      where: eq(appointments.employeeId, employee.id),
      orderBy: (a, { desc }) => [desc(a.effectivityDate)],
    });

    const workExperience: PdsWorkExperienceRow[] = appointmentRows.map((a) => ({
      from: a.effectivityDate,
      to: a.endDate,
      positionTitle: a.positionTitle,
      agency: org.agencyName,
      monthlySalary: a.monthlySalary != null ? Number(a.monthlySalary) : null,
      gradeStep: `${a.salaryGrade}-${a.step}`,
      statusOfAppointment: humanize(a.appointmentType),
      isGovService: true,
    }));

    // 5. Section VII — L&D (completed training participation)
    const participantRows = await db.query.trainingParticipants.findMany({
      where: and(
        eq(trainingParticipants.employeeId, employee.id),
        eq(trainingParticipants.status, "completed"),
      ),
      with: {
        run: {
          with: {
            program: true,
            provider: true,
          },
        },
      },
    });

    const trainings: PdsTrainingRow[] = participantRows.map((p) => ({
      title: p.run.program.title,
      from: toIsoDate(p.run.scheduledStart),
      to: toIsoDate(p.run.scheduledEnd),
      hours: null, // Not stored per-run; left blank rather than inferred.
      conductedBy: p.run.provider.companyName,
    }));

    // 6. Section VIII — special skills & hobbies (PDS Section 31)
    const skills = employee.specialSkillsHobbies?.skills ?? [];
    const hobbies = employee.specialSkillsHobbies?.hobbies ?? [];

    // 7. Map Section I personal information from the 201 file
    const employeeProps: PdsFormPdfProps["employee"] = {
      lastName: employee.lastName,
      firstName: employee.firstName,
      middleName: employee.middleName,
      suffix: employee.suffix,
      birthDate: employee.birthDate,
      gender: employee.gender,
      civilStatus: employee.civilStatus,
      nationality: employee.nationality,
      religion: employee.religion,
      bloodType: employee.bloodType,
      tin: employee.tin,
      gsisNo: employee.gsisNo,
      philhealthNo: employee.philhealthNo,
      pagibigNo: employee.pagibigNo,
      employeeNo: employee.employeeNo,
      email: employee.email,
      phone: employee.phone,
      addressStreet: employee.addressStreet,
      addressBarangay: employee.addressBarangay,
      addressCity: employee.addressCity,
      addressProvince: employee.addressProvince,
      addressZipCode: employee.addressZipCode,
    };

    // 8. Generate PDF blob
    const blob = await pdf(
      <PdsFormPdf
        serialNumber={serialNumber}
        agencyName={org.agencyName}
        employee={employeeProps}
        workExperience={workExperience}
        trainings={trainings}
        skills={skills}
        hobbies={hobbies}
      />,
    ).toBlob();

    // 9. Upload to Supabase Storage
    const supabase = await createServerClient();
    const fileName = `${serialNumber}.pdf`;
    const { error } = await supabase.storage
      .from("documents")
      .upload(`pds/${fileName}`, blob, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (error) {
      console.error("Failed to upload PDS to storage:", error);
      return {
        success: false,
        error: "Failed to save document to storage",
      };
    }

    // 10. Get public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(`pds/${fileName}`);

    // 11. Log issuance in the audit trail (PIM-016 serial issuance logging)
    await auditLog({
      userId: user.id,
      action: "document.pds.issue",
      table: "serial_sequences",
      newValues: {
        serialNumber,
        documentType: "PDS",
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
    console.error("PDS generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
