/**
 * PhilHealth RF-1 — Premium Remittance Form (React-PDF)
 *
 * The RF-1 is the official PhilHealth remittance form submitted by employers.
 * This template mirrors the PhilHealth RF-1 layout and is rendered server-side
 * via @react-pdf/renderer.
 *
 * Import dynamically in page components to avoid SSR issues:
 *   const { PhilHealthRf1Pdf } = await import('@/components/pdf/philhealth-rf1')
 */

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const CREAM = "#FAF4E6";
const BORDER = "#D1D5DB";
const GREEN = "#166534"; // PhilHealth brand accent

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 7,
    padding: 30,
    color: "#111827",
  },
  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  agencyBlock: { flexDirection: "column", gap: 1 },
  agencyName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: NAVY },
  agencySubtitle: { fontSize: 6.5, color: "#6B7280" },
  titleBlock: { alignItems: "center", flex: 1 },
  formCode: { fontSize: 8, fontFamily: "Helvetica-Bold", color: GREEN },
  formTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginTop: 1,
  },
  formSubtitle: { fontSize: 6.5, color: "#374151", marginTop: 1 },
  metaBlock: { alignItems: "flex-end", gap: 2 },
  metaLabel: { fontSize: 6, color: "#6B7280", textTransform: "uppercase" },
  metaValue: { fontSize: 7, fontFamily: "Helvetica-Bold", color: NAVY },
  divider: { height: 1.5, backgroundColor: GREEN, marginVertical: 6 },
  goldDivider: { height: 0.5, backgroundColor: GOLD, marginBottom: 8 },
  // Info section
  infoGrid: { flexDirection: "row", gap: 8, marginBottom: 10 },
  infoBox: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 2,
    padding: 6,
  },
  infoLabel: {
    fontSize: 6,
    color: "#9CA3AF",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  infoValue: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: NAVY },
  infoValueSmall: { fontSize: 7, color: "#374151" },
  // Table
  table: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 2,
    marginBottom: 12,
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: GREEN,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  tableHeadCell: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 6,
    textTransform: "uppercase",
    letterSpacing: 0.2,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.3,
    borderBottomColor: BORDER,
  },
  tableRowAlt: { backgroundColor: CREAM },
  tableCell: {
    paddingHorizontal: 4,
    paddingVertical: 3,
    fontSize: 6.5,
    color: "#1F2937",
  },
  tableCellMono: {
    paddingHorizontal: 4,
    paddingVertical: 3,
    fontSize: 6,
    fontFamily: "Courier",
    color: "#374151",
  },
  tableCellRight: {
    paddingHorizontal: 4,
    paddingVertical: 3,
    fontSize: 6.5,
    textAlign: "right",
    fontFamily: "Courier",
    color: "#1F2937",
  },
  tableCellRightBold: {
    paddingHorizontal: 4,
    paddingVertical: 3,
    fontSize: 6.5,
    textAlign: "right",
    fontFamily: "Courier-Bold",
    color: "#111827",
  },
  totalsRow: {
    flexDirection: "row",
    backgroundColor: NAVY,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  totalsLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    color: "#FFFFFF",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  totalsValue: {
    fontFamily: "Courier-Bold",
    fontSize: 6.5,
    color: GOLD,
    textAlign: "right",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  // Summary box
  summaryBox: {
    borderWidth: 0.5,
    borderColor: GREEN,
    borderRadius: 2,
    padding: 8,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
    textTransform: "uppercase",
    marginBottom: 6,
    borderBottomWidth: 0.3,
    borderBottomColor: BORDER,
    paddingBottom: 3,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
    borderBottomWidth: 0.2,
    borderBottomColor: "#F3F4F6",
  },
  summaryLabel: { fontSize: 7, color: "#374151" },
  summaryValue: { fontSize: 7, fontFamily: "Courier-Bold", color: NAVY },
  // Signature
  signatureBlock: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureLine: {
    borderTopWidth: 0.5,
    borderTopColor: "#374151",
    width: 160,
    paddingTop: 4,
  },
  signatureLabel: { fontSize: 6, color: "#6B7280", textTransform: "uppercase" },
  signatureName: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 1,
  },
  // Footer
  pageNumber: {
    position: "absolute",
    bottom: 14,
    right: 30,
    fontSize: 6,
    color: "#9CA3AF",
  },
  disclaimer: {
    position: "absolute",
    bottom: 14,
    left: 30,
    fontSize: 6,
    color: "#9CA3AF",
  },
});

// ─── Column widths ────────────────────────────────────────────────────────────

const COL = {
  no: "5%",
  pin: "12%",
  lastName: "16%",
  firstName: "14%",
  middleName: "12%",
  salary: "13%",
  eeShare: "11%",
  erShare: "11%",
  total: "6%",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Rf1Line {
  philhealthNo: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  basicMonthlySalary: string;
  employeeShare: string;
  employerShare: string;
  totalPremium: string;
}

export interface PhilHealthRf1Props {
  lines: Rf1Line[];
  meta: {
    agencyName: string;
    employerNo: string;
    periodLabel: string;
    periodStart: string;
    periodEnd: string;
    generatedAt: string;
    preparedBy: string;
    certifiedBy: string;
  };
  totals: {
    employeeShare: string;
    employerShare: string;
    totalPremium: string;
    employeeCount: number;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PhilHealthRf1Pdf({ lines, meta, totals }: PhilHealthRf1Props) {
  return (
    <Document
      title={`PhilHealth RF-1 — ${meta.periodLabel}`}
      author={meta.agencyName}
      subject="PhilHealth Premium Remittance Form RF-1"
    >
      <Page size="LEGAL" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.agencyBlock}>
            <Text style={styles.agencyName}>{meta.agencyName}</Text>
            <Text style={styles.agencySubtitle}>
              Republic of the Philippines
            </Text>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.formCode}>RF-1</Text>
            <Text style={styles.formTitle}>Premium Remittance Form</Text>
            <Text style={styles.formSubtitle}>
              Pursuant to R.A. 7875 as amended by R.A. 9241 and R.A. 10606
            </Text>
          </View>

          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Employer No.</Text>
            <Text style={styles.metaValue}>{meta.employerNo}</Text>
            <Text style={[styles.metaLabel, { marginTop: 3 }]}>Period</Text>
            <Text style={styles.metaValue}>{meta.periodLabel}</Text>
            <Text style={[styles.metaLabel, { marginTop: 3 }]}>Generated</Text>
            <Text style={styles.metaValue}>{meta.generatedAt}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Summary */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Remittance Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Employee (EE) Premium</Text>
            <Text style={styles.summaryValue}>
              PHP {fmt(totals.employeeShare)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Employer (ER) Premium</Text>
            <Text style={styles.summaryValue}>
              PHP {fmt(totals.employerShare)}
            </Text>
          </View>
          <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
            <Text
              style={[styles.summaryLabel, { fontFamily: "Helvetica-Bold" }]}
            >
              TOTAL PREMIUM REMITTANCE
            </Text>
            <Text style={[styles.summaryValue, { fontSize: 8, color: GREEN }]}>
              PHP {fmt(totals.totalPremium)}
            </Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadCell, { width: COL.no }]}>#</Text>
            <Text style={[styles.tableHeadCell, { width: COL.pin }]}>PIN</Text>
            <Text style={[styles.tableHeadCell, { width: COL.lastName }]}>
              Last Name
            </Text>
            <Text style={[styles.tableHeadCell, { width: COL.firstName }]}>
              First Name
            </Text>
            <Text style={[styles.tableHeadCell, { width: COL.middleName }]}>
              Middle Name
            </Text>
            <Text
              style={[
                styles.tableHeadCell,
                { width: COL.salary, textAlign: "right" },
              ]}
            >
              Basic Monthly Salary
            </Text>
            <Text
              style={[
                styles.tableHeadCell,
                { width: COL.eeShare, textAlign: "right" },
              ]}
            >
              EE Premium
            </Text>
            <Text
              style={[
                styles.tableHeadCell,
                { width: COL.erShare, textAlign: "right" },
              ]}
            >
              ER Premium
            </Text>
            <Text
              style={[
                styles.tableHeadCell,
                { width: COL.total, textAlign: "right" },
              ]}
            >
              Total
            </Text>
          </View>

          {lines.map((line, idx) => (
            <View
              key={`${line.philhealthNo}-${idx}`}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text
                style={[styles.tableCell, { width: COL.no, color: "#9CA3AF" }]}
              >
                {idx + 1}
              </Text>
              <Text style={[styles.tableCellMono, { width: COL.pin }]}>
                {line.philhealthNo}
              </Text>
              <Text style={[styles.tableCell, { width: COL.lastName }]}>
                {line.lastName.toUpperCase()}
              </Text>
              <Text style={[styles.tableCell, { width: COL.firstName }]}>
                {line.firstName}
              </Text>
              <Text style={[styles.tableCell, { width: COL.middleName }]}>
                {line.middleName ?? ""}
              </Text>
              <Text style={[styles.tableCellRight, { width: COL.salary }]}>
                {fmt(line.basicMonthlySalary)}
              </Text>
              <Text style={[styles.tableCellRight, { width: COL.eeShare }]}>
                {fmt(line.employeeShare)}
              </Text>
              <Text style={[styles.tableCellRight, { width: COL.erShare }]}>
                {fmt(line.employerShare)}
              </Text>
              <Text style={[styles.tableCellRightBold, { width: COL.total }]}>
                {fmt(line.totalPremium)}
              </Text>
            </View>
          ))}

          <View style={styles.totalsRow}>
            <Text
              style={[
                styles.totalsLabel,
                {
                  width: `calc(${COL.no} + ${COL.pin} + ${COL.lastName} + ${COL.firstName} + ${COL.middleName} + ${COL.salary})`,
                },
              ]}
            >
              {`TOTAL (${totals.employeeCount} employee${totals.employeeCount !== 1 ? "s" : ""})`}
            </Text>
            <Text style={[styles.totalsValue, { width: COL.eeShare }]}>
              {fmt(totals.employeeShare)}
            </Text>
            <Text style={[styles.totalsValue, { width: COL.erShare }]}>
              {fmt(totals.employerShare)}
            </Text>
            <Text style={[styles.totalsValue, { width: COL.total }]}>
              {fmt(totals.totalPremium)}
            </Text>
          </View>
        </View>

        {/* Signature block */}
        <View style={styles.signatureBlock}>
          <View>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{meta.preparedBy}</Text>
              <Text style={styles.signatureLabel}>
                Prepared by — HR / Payroll Officer
              </Text>
            </View>
          </View>
          <View>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{meta.certifiedBy}</Text>
              <Text style={styles.signatureLabel}>
                Certified Correct — Authorized Signatory
              </Text>
            </View>
          </View>
          <View>
            <View style={styles.signatureLine}>
              <Text style={[styles.signatureName, { color: "transparent" }]}>
                {"  "}
              </Text>
              <Text style={styles.signatureLabel}>
                Received by — PhilHealth Representative
              </Text>
            </View>
          </View>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
        <Text style={styles.disclaimer} fixed>
          Generated by PCSO HRIS — Confidential — For Official Use Only
        </Text>
      </Page>
    </Document>
  );
}
