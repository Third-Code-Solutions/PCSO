/**
 * Ad Hoc Certificate Generator
 * TOR 1.3.12 / 1.2.29 / 1.3.26 (PIM-018) — Serial number AHC-YYYY-NNNNNN
 *
 * Generates a template-driven ad hoc certificate:
 * - HRD-managed certificate_templates row (title + body with {{placeholders}})
 * - Placeholders substituted from the employee 201 file + org identity
 * - REFUSES to issue when any placeholder is unresolved (no serial, no upload)
 * - Configurable signatory chain (FM-022) resolved from fm_document_signatories
 * - Centralized serial number + PCSO letterhead PDF, stored in Supabase Storage
 */

"use server";

import { db } from "@/lib/db";
import { certificateTemplates, employees, orgProfile } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  generateSerialNumber,
  DOCUMENT_TYPES,
} from "@/lib/db/serial-sequence-helpers";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { pdf } from "@react-pdf/renderer";
import { createServerClient } from "@/lib/supabase/server";
import {
  buildEmployeePlaceholderValues,
  renderTemplate,
  formatLongDate,
  type EmployeePlaceholderSource,
} from "@/lib/utils/documents/template-render";
import { getPayrollSignatories } from "@/lib/utils/payroll/signatories";
import {
  AdhocCertificatePdf,
  type AdhocCertificateSignatory,
} from "@/components/pdf/adhoc-certificate";

interface GenerateAdhocCertificateParams {
  employeeId: string;
  templateId: string;
  /** Stated purpose — fills the `{{purpose}}` placeholder when present. */
  purpose?: string;
  /** Employee ID of the requester (for audit). */
  requestedBy?: string;
  /**
   * Serial number already bound to a document request (PIM-016). When provided,
   * it is reused instead of drawing a fresh one so a retry after a failed upload
   * does not burn a serial and gap the sequence. Omit to draw a new serial.
   */
  serialNumber?: string;
}

interface GenerateAdhocCertificateResult {
  success: boolean;
  serialNumber?: string;
  documentUrl?: string;
  error?: string;
}

export async function generateAdhocCertificate(
  params: GenerateAdhocCertificateParams,
): Promise<GenerateAdhocCertificateResult> {
  try {
    // Ad hoc certificate issuance is an HR-side operation, routed through the
    // same permission as the other document generators.
    const user = await requirePermission("employees", "process");

    // 1. Load the certificate template (active, not soft-deleted).
    const template = await db.query.certificateTemplates.findFirst({
      where: and(
        eq(certificateTemplates.id, params.templateId),
        eq(certificateTemplates.isActive, true),
        isNull(certificateTemplates.deletedAt),
      ),
    });

    if (!template) {
      return { success: false, error: "Template not found" };
    }

    // 2. Fetch employee data (+ office for the {{office}} placeholder).
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, params.employeeId),
      with: {
        office: true,
      },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    // 3. Fetch org profile.
    const org = await db.query.orgProfile.findFirst();
    if (!org) {
      return { success: false, error: "Organization profile not configured" };
    }

    // 4. Build the placeholder vocabulary from the 201 snapshot + org identity.
    const placeholderSource: EmployeePlaceholderSource = {
      firstName: employee.firstName,
      middleName: employee.middleName,
      lastName: employee.lastName,
      suffix: employee.suffix,
      employeeNo: employee.employeeNo,
      positionTitle: employee.positionTitle,
      officeName: employee.office?.name ?? null,
      salaryGrade: employee.salaryGrade,
      step: employee.step,
      dateHired: employee.dateHired,
      appointmentType: employee.appointmentType,
      civilStatus: employee.civilStatus,
    };

    const values = buildEmployeePlaceholderValues(placeholderSource, {
      agencyName: org.agencyName,
      purpose: params.purpose,
    });

    // 5. Substitute title + body.
    const renderedTitle = renderTemplate(template.title, values);
    const renderedBody = renderTemplate(template.bodyTemplate, values);

    // 6. CRITICAL: refuse to issue when any placeholder is unresolved. No
    //    serial is drawn and nothing is uploaded when this gate fails.
    const missingTitle = renderedTitle.missing;
    const missingBody = renderedBody.missing;
    if (missingTitle.length > 0 || missingBody.length > 0) {
      return {
        success: false,
        error: `Template has unresolved placeholders: ${[
          ...missingTitle,
          ...missingBody,
        ].join(", ")}`,
      };
    }

    // 7. Split the rendered body into paragraphs on blank lines.
    const paragraphs = renderedBody.text
      .split(/\n\s*\n/)
      .map((para) => para.trim())
      .filter((para) => para.length > 0);

    // 8. Resolve the configurable signatory chain (FM-022) for this template.
    const signatoryBlocks = await getPayrollSignatories(
      template.signatoryDocTypeCode ?? undefined,
    );
    const signatories: AdhocCertificateSignatory[] = signatoryBlocks.map(
      (block) => ({ title: block.title }),
    );

    // 9. Serial number — only after the placeholder gate. Reuse the
    //    request-bound serial (retry-safe, PIM-016) or draw a new one atomically.
    const serialNumber =
      params.serialNumber ??
      (await generateSerialNumber(DOCUMENT_TYPES.AD_HOC));

    // 10. Compose letterhead lines + issuance line.
    const contactLine =
      [org.contactEmail, org.contactPhone].filter(Boolean).join(" | ") || null;
    const issuedLine = `Issued on ${formatLongDate(new Date())} at ${
      org.agencyName
    }.`;

    // 11. Render the PDF blob.
    const blob = await pdf(
      <AdhocCertificatePdf
        serialNumber={serialNumber}
        agencyName={org.agencyName}
        agencyAddress={org.agencyAddress}
        contactLine={contactLine}
        title={renderedTitle.text}
        paragraphs={paragraphs}
        issuedLine={issuedLine}
        signatories={signatories}
      />,
    ).toBlob();

    // 12. Upload to Supabase Storage.
    const supabase = await createServerClient();
    const storagePath = `adhoc/${serialNumber}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, blob, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error(
        "Failed to upload ad hoc certificate to storage:",
        uploadError,
      );
      return { success: false, error: "Failed to save document to storage" };
    }

    // 13. Get public URL.
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(storagePath);

    // 14. Log issuance in the audit trail (PIM-016 serial issuance logging).
    await auditLog({
      userId: user.id,
      action: "document.adhoc.issue",
      table: "serial_sequences",
      newValues: {
        serialNumber,
        documentType: "AD_HOC",
        templateId: template.id,
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
    console.error("Ad hoc certificate generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
