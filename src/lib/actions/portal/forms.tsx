"use server";

/**
 * Portal — Official blank HR forms download (TOR 1.9.10 / EPM-015).
 *
 * Renders BLANK official forms server-side with @react-pdf/renderer and
 * returns them as data URLs (no storage side effects — blank forms are not
 * document issuances and carry no serial numbers).
 *
 * Forms served:
 *   - PDS (CS Form 212)         → existing PdsFormPdf rendered blank
 *   - Leave Form (CSC Form 6)   → existing LeaveForm6 rendered blank
 *   - SALN                      → forms/saln-blank template (the filled SALN
 *                                 renderer is an HTML component, not react-pdf)
 *   - Office Clearance          → forms/office-clearance template
 *   - Pass-Out Slip             → forms/pass-out-slip template
 *   - OB (Official Business)    → forms/ob-form template
 *   - PES Form                  → forms/pes-form template
 *
 * Agency identity comes from the org profile (P0-002).
 */

import { z } from "zod";
import { pdf } from "@react-pdf/renderer";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { PdsFormPdf } from "@/components/pdf/pds-form";
import { LeaveForm6 } from "@/components/pdf/leave-form-6";
import type { LeaveTypeCode } from "@/lib/constants/leave-types";
import { SalnBlankForm } from "@/components/pdf/forms/saln-blank";
import { OfficeClearanceForm } from "@/components/pdf/forms/office-clearance";
import { PassOutSlipForm } from "@/components/pdf/forms/pass-out-slip";
import { ObForm } from "@/components/pdf/forms/ob-form";
import { PesForm } from "@/components/pdf/forms/pes-form";

type Ok<T> = { data: T };
type Err = { error: string };
type Result<T> = Ok<T> | Err;

const FORM_KEYS = [
  "pds",
  "leave_form_6",
  "saln",
  "office_clearance",
  "pass_out_slip",
  "ob_form",
  "pes_form",
] as const;

const formKeySchema = z.enum(FORM_KEYS);

const FILE_NAMES: Record<(typeof FORM_KEYS)[number], string> = {
  pds: "PDS-CS-Form-212-blank.pdf",
  leave_form_6: "CSC-Form-6-Application-for-Leave-blank.pdf",
  saln: "SALN-blank.pdf",
  office_clearance: "Office-Clearance-blank.pdf",
  pass_out_slip: "Pass-Out-Slip-blank.pdf",
  ob_form: "Official-Business-Form-blank.pdf",
  pes_form: "PES-Form-blank.pdf",
};

function blankPdsElement(agencyName: string) {
  return (
    <PdsFormPdf
      serialNumber=""
      agencyName={agencyName}
      employee={{ lastName: "", firstName: "", employeeNo: "" }}
      workExperience={[]}
      trainings={[]}
      skills={[]}
      hobbies={[]}
    />
  );
}

function blankLeaveForm6Element() {
  return (
    <LeaveForm6
      application={{
        id: "",
        leaveTypeCode: "" as LeaveTypeCode,
        startDate: "",
        endDate: "",
        workingDays: "" as unknown as number,
        period: "" as unknown as "whole_day",
        reason: " ",
        status: "",
        approverRemarks: null,
        createdAt: "",
      }}
      employee={{
        firstName: "",
        lastName: "",
        employeeNo: "",
        positionTitle: "",
        salary: "",
        officeName: "",
        dateHired: "",
      }}
    />
  );
}

/**
 * Render a blank official HR form as a PDF data URL for download.
 * Any authenticated user may download blank forms.
 */
export async function generateBlankHrForm(
  formKey: string,
): Promise<Result<{ fileName: string; dataUrl: string }>> {
  const session = await requireAuth();
  const parsed = formKeySchema.safeParse(formKey);
  if (!parsed.success) return { error: "Unknown form" };
  const key = parsed.data;

  try {
    const org = await db.query.orgProfile.findFirst();
    if (!org) {
      return { error: "Organization profile not configured" };
    }
    const header = {
      agencyName: org.agencyName,
      agencyAddress: org.agencyAddress,
    };

    const element =
      key === "pds" ? (
        blankPdsElement(org.agencyName)
      ) : key === "leave_form_6" ? (
        blankLeaveForm6Element()
      ) : key === "saln" ? (
        <SalnBlankForm {...header} />
      ) : key === "office_clearance" ? (
        <OfficeClearanceForm {...header} />
      ) : key === "pass_out_slip" ? (
        <PassOutSlipForm {...header} />
      ) : key === "ob_form" ? (
        <ObForm {...header} />
      ) : (
        <PesForm {...header} />
      );

    const blob = await pdf(element).toBlob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const dataUrl = `data:application/pdf;base64,${buffer.toString("base64")}`;

    await auditLog({
      userId: session.id,
      action: "hr_form.blank_download",
      table: "org_profile",
      module: "EPM",
      subModule: "forms",
      newValues: { formKey: key },
    });

    return { data: { fileName: FILE_NAMES[key], dataUrl } };
  } catch (error) {
    console.error("[generateBlankHrForm]", error);
    return { error: "Failed to generate the form" };
  }
}
