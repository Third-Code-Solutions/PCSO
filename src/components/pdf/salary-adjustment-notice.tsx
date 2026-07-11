/**
 * Notice of Salary Adjustment (NOSA) PDF — React-PDF rendering.
 *
 * TOR 1.3.10 / PIM-015 — issued when an approved salary adjustment is
 * effected. Serial NOSA-YYYY-NNNNNN from the centralized serial system.
 * Layout mirrors the Step Increment Notice (step-increment-notice.tsx).
 *
 * Use with `renderToBuffer(<SalaryAdjustmentNoticePdf ... />)`.
 */

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ─── Styles ───────────────────────────────────────────────────────────────────

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const GRAY = "#6B7280";
const LIGHT_GRAY = "#F9FAFB";
const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    padding: 48,
    fontSize: 10,
    color: "#111827",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 12,
  },
  agency: {
    fontSize: 8,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 9,
    color: GRAY,
  },
  noticeNo: {
    marginTop: 16,
    textAlign: "right",
    fontSize: 9,
    color: GRAY,
  },
  detailsBox: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
    backgroundColor: LIGHT_GRAY,
  },
  detailsTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 4,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  detailLabel: {
    width: 180,
    fontSize: 9,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  detailValue: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  salaryDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  salaryBox: {
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 4,
    padding: "6 14",
    alignItems: "center",
  },
  salaryLabel: {
    fontSize: 7,
    color: GRAY,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  salaryValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  salaryMeta: {
    fontSize: 7,
    color: GRAY,
    marginTop: 2,
  },
  arrowText: {
    fontSize: 18,
    color: GOLD,
    fontFamily: "Helvetica-Bold",
  },
  body: {
    marginBottom: 20,
    lineHeight: 1.8,
  },
  paragraph: {
    fontSize: 10,
    marginBottom: 10,
    lineHeight: 1.8,
    textAlign: "justify",
  },
  reasonBox: {
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
    paddingLeft: 8,
  },
  reasonTitle: {
    fontSize: 8,
    color: GRAY,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 9,
    color: "#111827",
  },
  signatureSection: {
    marginTop: 32,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBlock: {
    width: 220,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    marginBottom: 4,
    height: 40,
  },
  signatureLabel: {
    fontSize: 8,
    color: GRAY,
    textTransform: "uppercase",
  },
  signatureName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 2,
  },
  signatureTitle: {
    fontSize: 8,
    color: GRAY,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 6,
    color: GRAY,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SalaryAdjustmentNoticePdfProps {
  noticeNumber: string;
  agencyName: string;
  employee: {
    fullName: string;
    employeeNo: string;
    positionTitle: string;
    officeName: string;
  };
  adjustmentTypeLabel: string;
  oldSalary: number | null;
  newSalary: number;
  oldGrade?: number | null;
  newGrade?: number | null;
  oldStep?: number | null;
  newStep?: number | null;
  effectiveDate: string;
  reason?: string | null;
  issuedByName: string;
  issuedByTitle: string;
  issuedDate: string;
  generatedAt?: string;
}

function money(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function gradeStep(grade?: number | null, step?: number | null): string | null {
  if (grade == null && step == null) return null;
  const parts: string[] = [];
  if (grade != null) parts.push(`SG ${grade}`);
  if (step != null) parts.push(`Step ${step}`);
  return parts.join(", ");
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SalaryAdjustmentNoticePdf({
  noticeNumber,
  agencyName,
  employee,
  adjustmentTypeLabel,
  oldSalary,
  newSalary,
  oldGrade,
  newGrade,
  oldStep,
  newStep,
  effectiveDate,
  reason,
  issuedByName,
  issuedByTitle,
  issuedDate,
  generatedAt,
}: SalaryAdjustmentNoticePdfProps) {
  const formattedEffectivity = new Date(
    `${effectiveDate}T00:00:00`,
  ).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const oldMeta = gradeStep(oldGrade, oldStep);
  const newMeta = gradeStep(newGrade, newStep);

  return (
    <Document
      title={`Notice of Salary Adjustment — ${employee.fullName}`}
      author={agencyName}
    >
      <Page size="LETTER" style={styles.page}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.agency}>{agencyName}</Text>
          <Text style={styles.title}>Notice of Salary Adjustment</Text>
          <Text style={styles.subtitle}>
            Issued pursuant to approved salary adjustment authority and
            applicable DBM / CSC compensation rules
          </Text>
        </View>

        <Text style={styles.noticeNo}>Notice No.: {noticeNumber}</Text>
        <Text style={styles.noticeNo}>Date: {issuedDate}</Text>

        {/* ── Employee Details ──────────────────────────────────────────── */}
        <View style={styles.detailsBox}>
          <Text style={styles.detailsTitle}>Employee Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Name</Text>
            <Text style={styles.detailValue}>{employee.fullName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Employee No.</Text>
            <Text style={styles.detailValue}>{employee.employeeNo}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Position Title</Text>
            <Text style={styles.detailValue}>{employee.positionTitle}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Office / Division</Text>
            <Text style={styles.detailValue}>{employee.officeName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Nature of Adjustment</Text>
            <Text style={styles.detailValue}>{adjustmentTypeLabel}</Text>
          </View>

          {/* Salary visualization */}
          <View style={styles.salaryDisplay}>
            <View style={styles.salaryBox}>
              <Text style={styles.salaryLabel}>Present Monthly Salary</Text>
              <Text style={styles.salaryValue}>
                {oldSalary != null ? money(oldSalary) : "—"}
              </Text>
              {oldMeta ? (
                <Text style={styles.salaryMeta}>{oldMeta}</Text>
              ) : null}
            </View>
            <Text style={styles.arrowText}>→</Text>
            <View style={[styles.salaryBox, { borderColor: GOLD }]}>
              <Text style={styles.salaryLabel}>Adjusted Monthly Salary</Text>
              <Text style={[styles.salaryValue, { color: GOLD }]}>
                {money(newSalary)}
              </Text>
              {newMeta ? (
                <Text style={styles.salaryMeta}>{newMeta}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Effectivity Date</Text>
            <Text style={styles.detailValue}>{formattedEffectivity}</Text>
          </View>
        </View>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <View style={styles.body}>
          <Text style={styles.paragraph}>
            Please be informed that your monthly basic salary as{" "}
            {employee.positionTitle} is hereby adjusted
            {oldSalary != null ? ` from ${money(oldSalary)}` : ""} to{" "}
            {money(newSalary)}
            {newMeta ? ` (${newMeta})` : ""}, effective {formattedEffectivity},
            by reason of {adjustmentTypeLabel.toLowerCase()}.
          </Text>

          <Text style={styles.paragraph}>
            This Notice of Salary Adjustment forms part of your 201 file. The
            adjustment has been recorded in the Human Resource System and will
            be reflected in the corresponding payroll period.
          </Text>

          {reason ? (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonTitle}>Basis / Remarks</Text>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Signatures ────────────────────────────────────────────────── */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{issuedByName}</Text>
            <Text style={styles.signatureTitle}>{issuedByTitle}</Text>
            <Text style={styles.signatureLabel}>Approved / Issued By</Text>
          </View>

          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{employee.fullName}</Text>
            <Text style={styles.signatureLabel}>
              Employee Acknowledgement / Date
            </Text>
          </View>
        </View>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Notice No. {noticeNumber} — {agencyName} HRIS
          </Text>
          <Text style={styles.footerText}>
            Generated: {generatedAt ?? new Date().toLocaleDateString("en-PH")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
