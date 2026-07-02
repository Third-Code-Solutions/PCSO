/**
 * Certificate of Employment (COE) Generator
 * PRD PIM-010 — Serial number COE-YYYY-NNNNNN
 *
 * Generates official Certificate of Employment with:
 * - PCSO letterhead
 * - Employee name, position, period of employment
 * - Civil status
 * - Salary (optional field, configurable per request)
 * - Configurable signatory (from FM)
 * - QR code for verification (PRD PIM-017)
 */

"use server";

import { db } from "@/lib/db";
import { employees, orgProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  generateSerialNumber,
  DOCUMENT_TYPES,
} from "@/lib/db/serial-sequence-helpers";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { createServerClient } from "@/lib/supabase/server";

// PDF Styles for COE
const styles = StyleSheet.create({
  page: {
    padding: 60,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.6,
  },
  header: {
    textAlign: "center",
    marginBottom: 30,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 10,
    alignSelf: "center",
  },
  agencyName: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#1B4F9E", // PCSO Navy
  },
  agencyAddress: {
    fontSize: 9,
    marginBottom: 2,
    color: "#666",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 30,
    marginBottom: 20,
    textDecoration: "underline",
  },
  serialNumber: {
    fontSize: 9,
    textAlign: "right",
    marginBottom: 10,
    color: "#666",
  },
  body: {
    marginTop: 20,
    marginBottom: 30,
  },
  paragraph: {
    marginBottom: 15,
    textAlign: "justify",
  },
  signature: {
    marginTop: 40,
  },
  signatureName: {
    fontWeight: "bold",
    marginBottom: 2,
  },
  signatureTitle: {
    fontSize: 10,
    color: "#666",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 60,
    right: 60,
    fontSize: 8,
    color: "#999",
    textAlign: "center",
  },
});

interface GenerateCOEParams {
  employeeId: string;
  purpose: string;
  includeSalary?: boolean;
  requestedBy?: string; // Employee ID of requester (for audit)
}

interface GenerateCOEResult {
  success: boolean;
  serialNumber?: string;
  documentUrl?: string;
  error?: string;
}

export async function generateCOE(
  params: GenerateCOEParams,
): Promise<GenerateCOEResult> {
  try {
    // COE issuance is an HR-side operation (document requests route through
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
    const serialNumber = await generateSerialNumber(DOCUMENT_TYPES.COE);

    // 4. Calculate employment period
    const hireDate = new Date(employee.dateHired);
    const currentDate = new Date();
    const years = currentDate.getFullYear() - hireDate.getFullYear();
    const months = currentDate.getMonth() - hireDate.getMonth();

    let employmentPeriod = "";
    if (years > 0) {
      employmentPeriod = `${years} year${years > 1 ? "s" : ""}`;
      if (months > 0) {
        employmentPeriod += ` and ${months} month${months > 1 ? "s" : ""}`;
      }
    } else if (months > 0) {
      employmentPeriod = `${months} month${months > 1 ? "s" : ""}`;
    } else {
      employmentPeriod = "less than one month";
    }

    // 5. Format employee name
    const fullName = [
      employee.firstName,
      employee.middleName ? `${employee.middleName.charAt(0)}.` : "",
      employee.lastName,
      employee.suffix || "",
    ]
      .filter(Boolean)
      .join(" ");

    // 6. Format civil status
    const civilStatusMap: Record<string, string> = {
      single: "Single",
      married: "Married",
      widowed: "Widowed",
      legally_separated: "Legally Separated",
      annulled: "Annulled",
    };
    const civilStatus =
      civilStatusMap[employee.civilStatus] || employee.civilStatus;

    // 7. Generate PDF
    const COEDocument = () => (
      <Document>
        <Page size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.agencyName}>{org.agencyName}</Text>
            <Text style={styles.agencyAddress}>{org.agencyAddress}</Text>
            <Text style={styles.agencyAddress}>
              {org.contactEmail} | {org.contactPhone}
            </Text>
          </View>

          {/* Serial Number */}
          <Text style={styles.serialNumber}>Serial No.: {serialNumber}</Text>

          {/* Title */}
          <Text style={styles.title}>CERTIFICATE OF EMPLOYMENT</Text>

          {/* Date */}
          <Text style={{ fontSize: 10, marginBottom: 20 }}>
            {currentDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </Text>

          {/* Body */}
          <View style={styles.body}>
            <Text style={styles.paragraph}>TO WHOM IT MAY CONCERN:</Text>

            <Text style={styles.paragraph}>
              This is to certify that{" "}
              <Text style={{ fontWeight: "bold" }}>
                {fullName.toUpperCase()}
              </Text>
              ,{civilStatus && `, ${civilStatus},`} has been employed with the{" "}
              {org.agencyName} as{" "}
              <Text style={{ fontWeight: "bold" }}>
                {employee.positionTitle}
              </Text>{" "}
              from{" "}
              {hireDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}{" "}
              to present, or for a period of {employmentPeriod}.
            </Text>

            {params.includeSalary && employee.salaryGrade && employee.step && (
              <Text style={styles.paragraph}>
                The employee is currently receiving a monthly salary under
                Salary Grade {employee.salaryGrade}, Step {employee.step}.
              </Text>
            )}

            <Text style={styles.paragraph}>
              This certification is being issued upon the request of {fullName}{" "}
              for {params.purpose || "whatever legal purpose it may serve"}.
            </Text>
          </View>

          {/* Signature */}
          <View style={styles.signature}>
            <Text style={styles.signatureName}>
              [AUTHORIZED SIGNATORY NAME]
            </Text>
            <Text style={styles.signatureTitle}>
              [AUTHORIZED SIGNATORY TITLE]
            </Text>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            This is an electronically generated document. No signature is
            required.
            {"\n"}
            Document Serial Number: {serialNumber}
          </Text>
        </Page>
      </Document>
    );

    // 8. Generate PDF blob
    const pdfBlob = await pdf(<COEDocument />).toBlob();

    // 9. Upload to Supabase Storage
    const supabase = await createServerClient();
    const fileName = `${serialNumber}.pdf`;
    const { data, error } = await supabase.storage
      .from("documents")
      .upload(`coe/${fileName}`, pdfBlob, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (error) {
      console.error("Failed to upload COE to storage:", error);
      return {
        success: false,
        error: "Failed to save document to storage",
      };
    }

    // 10. Get public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(`coe/${fileName}`);

    // 11. Log issuance in the audit trail (PIM-016 serial issuance logging)
    await auditLog({
      userId: user.id,
      action: "document.coe.issue",
      table: "serial_sequences",
      newValues: {
        serialNumber,
        documentType: params.includeSalary ? "COE_REMUNERATION" : "COE",
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
    console.error("COE generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
