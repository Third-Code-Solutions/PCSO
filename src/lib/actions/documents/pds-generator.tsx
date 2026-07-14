/**
 * Personal Data Sheet (CS Form No. 212, Revised 2017) Generator
 * TOR 1.3.11 / PIM-013 — Serial number PDS-YYYY-NNNNNN
 *
 * Generates the official 4-page CSC Personal Data Sheet, auto-populated from
 * the employee 201 file:
 *   I    Personal Information  → employees (incl. PDS profile extras)
 *   II   Family Background     → employee_family_members
 *   III  Educational Background → employee_education
 *   IV   Civil Service Eligibility → employee_eligibilities
 *   V    Work Experience       → employee_work_experiences + appointments
 *   VI   Voluntary Work        → employee_voluntary_works
 *   VII  Learning & Development → employee_external_trainings + LDM records
 *   VIII Other Information     → skills/hobbies, distinctions, memberships
 *   34–40 Questions + Gov't ID → employees.pds_questionnaire / government_issued_id
 *
 * Section 41 (character references) is not system-captured and renders blank.
 * Row-to-props mapping lives in the pure, unit-tested
 * `src/lib/utils/pimm/pds-mapper.ts`.
 */

"use server";

import { db } from "@/lib/db";
import {
  employees,
  appointments,
  trainingParticipants,
  employeeFamilyMembers,
  employeeEducation,
  employeeEligibilities,
  employeeWorkExperiences,
  employeeVoluntaryWorks,
  employeeExternalTrainings,
} from "@/lib/db/schema";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import {
  generateSerialNumber,
  DOCUMENT_TYPES,
} from "@/lib/db/serial-sequence-helpers";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { pdf } from "@react-pdf/renderer";
import { createServerClient } from "@/lib/supabase/server";
import { PdsFormPdf, type PdsTrainingRow } from "@/components/pdf/pds-form";
import { buildPdsFormProps } from "@/lib/utils/pimm/pds-mapper";

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

    // 4. Fetch 201-file child rows (soft-deleted rows excluded) + PCSO history
    const [
      familyRows,
      educationRows,
      eligibilityRows,
      workRows,
      voluntaryRows,
      externalTrainingRows,
      appointmentRows,
      participantRows,
    ] = await Promise.all([
      db
        .select()
        .from(employeeFamilyMembers)
        .where(
          and(
            eq(employeeFamilyMembers.employeeId, employee.id),
            isNull(employeeFamilyMembers.deletedAt),
          ),
        )
        .orderBy(asc(employeeFamilyMembers.sortOrder)),
      db
        .select()
        .from(employeeEducation)
        .where(
          and(
            eq(employeeEducation.employeeId, employee.id),
            isNull(employeeEducation.deletedAt),
          ),
        )
        .orderBy(
          asc(employeeEducation.level),
          asc(employeeEducation.sortOrder),
        ),
      db
        .select()
        .from(employeeEligibilities)
        .where(
          and(
            eq(employeeEligibilities.employeeId, employee.id),
            isNull(employeeEligibilities.deletedAt),
          ),
        )
        .orderBy(desc(employeeEligibilities.examDate)),
      db
        .select()
        .from(employeeWorkExperiences)
        .where(
          and(
            eq(employeeWorkExperiences.employeeId, employee.id),
            isNull(employeeWorkExperiences.deletedAt),
          ),
        )
        .orderBy(desc(employeeWorkExperiences.dateFrom)),
      db
        .select()
        .from(employeeVoluntaryWorks)
        .where(
          and(
            eq(employeeVoluntaryWorks.employeeId, employee.id),
            isNull(employeeVoluntaryWorks.deletedAt),
          ),
        )
        .orderBy(desc(employeeVoluntaryWorks.dateFrom)),
      db
        .select()
        .from(employeeExternalTrainings)
        .where(
          and(
            eq(employeeExternalTrainings.employeeId, employee.id),
            isNull(employeeExternalTrainings.deletedAt),
          ),
        )
        .orderBy(desc(employeeExternalTrainings.dateFrom)),
      db.query.appointments.findMany({
        where: eq(appointments.employeeId, employee.id),
        orderBy: (a, { desc: d }) => [d(a.effectivityDate)],
      }),
      db.query.trainingParticipants.findMany({
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
      }),
    ]);

    // 5. LDM (in-house) participation → Section VII rows
    const ldmTrainings: PdsTrainingRow[] = participantRows.map((p) => ({
      title: p.run.program.title,
      from: toIsoDate(p.run.scheduledStart),
      to: toIsoDate(p.run.scheduledEnd),
      hours: null, // Not stored per-run; left blank rather than inferred.
      conductedBy: p.run.provider.companyName,
    }));

    // 6. Map 201 rows → PDF props (pure, unit-tested)
    const formData = buildPdsFormProps({
      employee,
      agencyName: org.agencyName,
      familyMembers: familyRows,
      education: educationRows,
      eligibilities: eligibilityRows,
      externalWorkExperiences: workRows,
      appointments: appointmentRows,
      voluntaryWorks: voluntaryRows,
      externalTrainings: externalTrainingRows,
      ldmTrainings,
    });

    // 7. Generate PDF blob
    const blob = await pdf(
      <PdsFormPdf serialNumber={serialNumber} {...formData} />,
    ).toBlob();

    // 8. Upload to Supabase Storage
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

    // 9. Get public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(`pds/${fileName}`);

    // 10. Log issuance in the audit trail (PIM-016 serial issuance logging)
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
