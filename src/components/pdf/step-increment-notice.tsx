/**
 * Step Increment Notice PDF — React-PDF rendering.
 *
 * DBM-required Notice of Salary Step Increment.
 * Issued to eligible employees who meet the CSC step increment criteria.
 *
 * Reference: DBM National Budget Circular 461
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
  body: {
    marginBottom: 20,
    lineHeight: 1.8,
  },
  greeting: {
    fontSize: 10,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 10,
    marginBottom: 10,
    lineHeight: 1.8,
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
  stepDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  stepBox: {
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 4,
    padding: "4 12",
    alignItems: "center",
  },
  stepLabel: {
    fontSize: 7,
    color: GRAY,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  stepValue: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  arrowText: {
    fontSize: 18,
    color: GOLD,
    fontFamily: "Helvetica-Bold",
  },
  basisBox: {
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
    paddingLeft: 8,
  },
  basisTitle: {
    fontSize: 8,
    color: GRAY,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  basisItem: {
    fontSize: 9,
    color: "#111827",
    marginBottom: 2,
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
  acknowledgementBox: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 12,
  },
  acknowledgementTitle: {
    fontSize: 8,
    color: GRAY,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  acknowledgementLine: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 4,
    height: 24,
  },
  acknowledgementLabel: {
    fontSize: 7,
    color: GRAY,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StepIncrementNoticePdfProps {
  noticeNumber: string;
  employee: {
    fullName: string;
    employeeNo: string;
    positionTitle: string;
    officeName: string;
    salaryGrade: number;
  };
  fromStep: number;
  toStep: number;
  effectivityDate: string;
  basisPeriods: Array<{
    label: string;
    adjectival: string;
    numerical: number;
  }>;
  issuedByName: string;
  issuedByTitle: string;
  issuedDate: string;
  approvedByName?: string;
  generatedAt?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepIncrementNoticePdf({
  noticeNumber,
  employee,
  fromStep,
  toStep,
  effectivityDate,
  basisPeriods,
  issuedByName,
  issuedByTitle,
  issuedDate,
  approvedByName,
  generatedAt,
}: StepIncrementNoticePdfProps) {
  const formattedEffectivity = new Date(effectivityDate).toLocaleDateString(
    "en-PH",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

  return (
    <Document
      title={`Notice of Step Increment — ${employee.fullName}`}
      author="PCSO HRIS"
    >
      <Page size="LETTER" style={styles.page}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.agency}>
            Philippine Charity Sweepstakes Office
          </Text>
          <Text style={styles.title}>Notice of Salary Step Increment</Text>
          <Text style={styles.subtitle}>
            Pursuant to DBM National Budget Circular 461 and CSC MC No. 6, s.
            2012
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
            <Text style={styles.detailLabel}>Salary Grade</Text>
            <Text style={styles.detailValue}>SG {employee.salaryGrade}</Text>
          </View>

          {/* Step visualization */}
          <View style={styles.stepDisplay}>
            <View style={styles.stepBox}>
              <Text style={styles.stepLabel}>Current Step</Text>
              <Text style={styles.stepValue}>{fromStep}</Text>
            </View>
            <Text style={styles.arrowText}>→</Text>
            <View style={[styles.stepBox, { borderColor: GOLD }]}>
              <Text style={styles.stepLabel}>New Step</Text>
              <Text style={[styles.stepValue, { color: GOLD }]}>{toStep}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Effectivity Date</Text>
            <Text style={styles.detailValue}>{formattedEffectivity}</Text>
          </View>
        </View>

        {/* ── Body text ─────────────────────────────────────────────────── */}
        <View style={styles.body}>
          <Text style={styles.paragraph}>
            This is to certify that {employee.fullName},{" "}
            {employee.positionTitle}, is hereby granted a Salary Step Increment
            from Step {fromStep} to Step {toStep}, Salary Grade{" "}
            {employee.salaryGrade}, effective {formattedEffectivity}.
          </Text>

          <Text style={styles.paragraph}>
            The step increment is granted in accordance with CSC Memorandum
            Circular No. 6, series of 2012, and DBM National Budget Circular
            461, based on the following performance rating periods:
          </Text>

          {/* Basis periods */}
          <View style={styles.basisBox}>
            <Text style={styles.basisTitle}>Basis Performance Ratings</Text>
            {basisPeriods.map((bp, idx) => (
              <Text key={idx} style={styles.basisItem}>
                {idx + 1}. {bp.label} — {bp.numerical.toFixed(3)} (
                {bp.adjectival.replace("_", " ").toUpperCase()})
              </Text>
            ))}
          </View>
        </View>

        {/* ── Signatures ─────────────────────────────────────────────────── */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{issuedByName}</Text>
            <Text style={styles.signatureTitle}>{issuedByTitle}</Text>
            <Text style={styles.signatureLabel}>Issued By</Text>
          </View>

          {approvedByName && (
            <View style={styles.signatureBlock}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureName}>{approvedByName}</Text>
              <Text style={styles.signatureLabel}>Approved By</Text>
            </View>
          )}
        </View>

        {/* ── Acknowledgement ───────────────────────────────────────────── */}
        <View style={styles.acknowledgementBox}>
          <Text style={styles.acknowledgementTitle}>
            Acknowledgement Receipt
          </Text>
          <View style={styles.acknowledgementLine} />
          <Text style={styles.acknowledgementLabel}>
            Signature over Printed Name / Date Received — {employee.fullName}
          </Text>
        </View>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Notice No. {noticeNumber} — PCSO HRIS
          </Text>
          <Text style={styles.footerText}>
            Generated: {generatedAt ?? new Date().toLocaleDateString("en-PH")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
