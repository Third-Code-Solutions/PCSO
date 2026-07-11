/**
 * Payroll Register PDF — full list of all employee records for a period.
 * Used by Finance for reconciliation and COA audits.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { PayrollPeriod } from "@/lib/db/schema";
import type { PayrollRecordWithEmployee } from "@/app/(dashboard)/payroll/queries";
import type { SignatoryBlock } from "@/lib/utils/payroll/signatories";

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const BORDER = "#E5E7EB";
const GRAY = "#6B7280";
const ALT = "#F9FAFB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 7.5,
    backgroundColor: "#FFFFFF",
    padding: 28,
    color: "#111827",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 8,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerLeft: {},
  agencyName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  headerMeta: {
    fontSize: 7,
    color: GRAY,
    marginTop: 1,
  },
  reportTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "right",
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  th: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  rowAlt: {
    backgroundColor: ALT,
  },
  td: {
    fontSize: 7,
    color: "#374151",
  },
  tdMono: {
    fontSize: 7,
    fontFamily: "Helvetica",
    color: "#374151",
    textAlign: "right",
  },
  // Column widths
  colName: { width: "20%" },
  colEmpNo: { width: "8%" },
  colPos: { width: "15%" },
  colSG: { width: "6%", textAlign: "center" },
  colGross: { width: "10%", textAlign: "right" },
  colDed: { width: "10%", textAlign: "right" },
  colNet: { width: "10%", textAlign: "right" },
  colGsis: { width: "8%", textAlign: "right" },
  colTax: { width: "8%", textAlign: "right" },
  colStatus: { width: "5%", textAlign: "center" },
  // Totals
  totalsRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: NAVY,
    marginTop: 2,
  },
  totalLabel: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
  },
  totalValue: {
    color: GOLD,
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    textAlign: "right",
  },
  // Signatory band (TOR 1.8.6)
  signatories: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 32,
    paddingHorizontal: 4,
  },
  sigBlock: { width: "30%" },
  sigCaption: {
    fontSize: 7.5,
    color: GRAY,
    marginBottom: 24,
  },
  sigLine: {
    borderTopWidth: 1,
    borderTopColor: "#111827",
    paddingTop: 3,
  },
  sigTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 28,
    right: 28,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    color: GRAY,
    fontSize: 6.5,
    fontStyle: "italic",
  },
  pageNumber: {
    color: GRAY,
    fontSize: 6.5,
  },
});

function formatPeso(value: string | null | undefined): string {
  if (!value) return "0.00";
  const num = parseFloat(value);
  return num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortName(r: PayrollRecordWithEmployee): string {
  const emp = r.employee;
  const mi = emp.middleName ? ` ${emp.middleName.charAt(0)}.` : "";
  return `${emp.lastName}, ${emp.firstName}${mi}`;
}

interface PayrollRegisterDocumentProps {
  period: PayrollPeriod;
  records: PayrollRecordWithEmployee[];
  generatedAt?: string;
  /** TOR 1.8.6 — configurable signatory chain (Prepared/Certified/Approved). */
  signatories?: SignatoryBlock[];
}

export function PayrollRegisterDocument({
  period,
  records,
  generatedAt,
  signatories,
}: PayrollRegisterDocumentProps) {
  const totalGross = records.reduce((s, r) => s + parseFloat(r.grossPay), 0);
  const totalDed = records.reduce(
    (s, r) => s + parseFloat(r.totalDeductions),
    0,
  );
  const totalNet = records.reduce((s, r) => s + parseFloat(r.netPay), 0);
  const totalGsis = records.reduce((s, r) => s + parseFloat(r.gsisPersonal), 0);
  const totalTax = records.reduce(
    (s, r) => s + parseFloat(r.withholdingTax),
    0,
  );

  const genTs = generatedAt
    ? new Date(generatedAt).toLocaleString("en-PH")
    : new Date().toLocaleString("en-PH");

  return (
    <Document
      title={`Payroll Register - ${period.name}`}
      author="PCSO HRIS"
      subject="Payroll Register"
    >
      <Page size="LEGAL" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.agencyName}>
              PHILIPPINE CHARITY SWEEPSTAKES OFFICE
            </Text>
            <Text style={styles.headerMeta}>Financial Services Department</Text>
          </View>
          <View>
            <Text style={styles.reportTitle}>PAYROLL REGISTER</Text>
            <Text style={[styles.headerMeta, { textAlign: "right" }]}>
              {period.name}
            </Text>
            <Text style={[styles.headerMeta, { textAlign: "right" }]}>
              Scope:{" "}
              {period.scope === "jo_cos"
                ? "JO/COS Employees"
                : "Regular Employees"}{" "}
              | Records: {records.length}
            </Text>
          </View>
        </View>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colName]}>Employee Name</Text>
          <Text style={[styles.th, styles.colEmpNo]}>Emp. No.</Text>
          <Text style={[styles.th, styles.colPos]}>Position</Text>
          <Text style={[styles.th, styles.colSG]}>SG</Text>
          <Text style={[styles.th, styles.colGross]}>Gross Pay</Text>
          <Text style={[styles.th, styles.colGsis]}>GSIS</Text>
          <Text style={[styles.th, styles.colTax]}>W/Tax</Text>
          <Text style={[styles.th, styles.colDed]}>Total Ded.</Text>
          <Text style={[styles.th, styles.colNet]}>Net Pay</Text>
          <Text style={[styles.th, styles.colStatus]}>Status</Text>
        </View>

        {/* Rows */}
        {records.map((r, index) => (
          <View
            key={r.id}
            style={[styles.row, index % 2 === 1 ? styles.rowAlt : {}]}
          >
            <Text style={[styles.td, styles.colName]}>{shortName(r)}</Text>
            <Text style={[styles.td, styles.colEmpNo]}>
              {r.employee.employeeNo}
            </Text>
            <Text style={[styles.td, styles.colPos]}>{r.positionTitle}</Text>
            <Text style={[styles.td, styles.colSG]}>
              {r.salaryGrade}-{r.step}
            </Text>
            <Text style={[styles.tdMono, styles.colGross]}>
              {formatPeso(r.grossPay)}
            </Text>
            <Text style={[styles.tdMono, styles.colGsis]}>
              {formatPeso(r.gsisPersonal)}
            </Text>
            <Text style={[styles.tdMono, styles.colTax]}>
              {formatPeso(r.withholdingTax)}
            </Text>
            <Text style={[styles.tdMono, styles.colDed]}>
              {formatPeso(r.totalDeductions)}
            </Text>
            <Text
              style={[
                styles.tdMono,
                styles.colNet,
                { fontFamily: "Helvetica-Bold" },
              ]}
            >
              {formatPeso(r.netPay)}
            </Text>
            <Text style={[styles.td, styles.colStatus]}>
              {r.hasException ? "!" : r.status.charAt(0).toUpperCase()}
            </Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsRow}>
          <Text style={[styles.totalLabel, styles.colName]}>
            TOTAL ({records.length})
          </Text>
          <Text style={[styles.totalLabel, styles.colEmpNo]} />
          <Text style={[styles.totalLabel, styles.colPos]} />
          <Text style={[styles.totalLabel, styles.colSG]} />
          <Text style={[styles.totalValue, styles.colGross]}>
            {formatPeso(totalGross.toFixed(2))}
          </Text>
          <Text style={[styles.totalValue, styles.colGsis]}>
            {formatPeso(totalGsis.toFixed(2))}
          </Text>
          <Text style={[styles.totalValue, styles.colTax]}>
            {formatPeso(totalTax.toFixed(2))}
          </Text>
          <Text style={[styles.totalValue, styles.colDed]}>
            {formatPeso(totalDed.toFixed(2))}
          </Text>
          <Text style={[styles.totalValue, styles.colNet]}>
            {formatPeso(totalNet.toFixed(2))}
          </Text>
          <Text style={[styles.totalLabel, styles.colStatus]} />
        </View>

        {/* Signatories (TOR 1.8.6) */}
        {signatories && signatories.length > 0 && (
          <View style={styles.signatories} wrap={false}>
            {signatories.map((s) => (
              <View
                key={`${s.role}-${s.sequenceOrder}`}
                style={styles.sigBlock}
              >
                <Text style={styles.sigCaption}>{s.caption}:</Text>
                <View style={styles.sigLine}>
                  <Text style={styles.sigTitle}>{s.title}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            PCSO HRIS — Payroll Register — {period.name} — Generated: {genTs}
          </Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
