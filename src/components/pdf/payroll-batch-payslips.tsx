/**
 * Batch payslips PDF — compiles all employee payslips into one document.
 * Each employee gets one LETTER page.
 *
 * Implementation note: React-PDF does not support nested <Document> components.
 * We duplicate the single payslip page structure here using a shared helper.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { PayrollPeriod, PayrollRecord } from "@/lib/db/schema";
import type { PayrollRecordWithEmployee } from "@/app/(dashboard)/payroll/queries";

const NAVY = "#1B4F9E";
const GOLD = "#FFCB05";
const CREAM = "#FFF8E7";
const GRAY = "#6B7280";
const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    padding: 36,
    fontSize: 9,
    color: "#111827",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 12,
    marginBottom: 12,
    gap: 12,
  },
  sealPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: NAVY,
    justifyContent: "center",
    alignItems: "center",
  },
  sealText: {
    color: GOLD,
    fontSize: 7,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
  },
  headerText: { flex: 1 },
  agency: { fontSize: 13, fontFamily: "Helvetica-Bold", color: NAVY },
  agencySub: { fontSize: 7, color: GRAY, marginTop: 1 },
  payslipTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "right",
  },
  periodLabel: { fontSize: 7, color: GRAY, textAlign: "right", marginTop: 1 },
  empBlock: {
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
    flexDirection: "row",
    gap: 12,
  },
  empCol: { flex: 1 },
  fieldLabel: {
    fontSize: 7,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  fieldValue: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 6,
  },
  columns: { flexDirection: "row", gap: 10, marginBottom: 10 },
  column: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 3,
    overflow: "hidden",
  },
  colHeader: {
    backgroundColor: NAVY,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  colHeaderText: {
    color: "#FFFFFF",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
  },
  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  lineItemAlt: { backgroundColor: "#F9FAFB" },
  lineLabel: { color: "#374151", flex: 1, fontSize: 8 },
  lineValue: { fontFamily: "Helvetica-Bold", fontSize: 8, textAlign: "right" },
  lineValueNeg: {
    color: "#DC2626",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: NAVY,
  },
  totalLabel: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8 },
  totalValue: { color: GOLD, fontFamily: "Helvetica-Bold", fontSize: 8 },
  netPayBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: NAVY,
    borderRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 10,
  },
  netLabel: {
    color: GOLD,
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    letterSpacing: 1.5,
  },
  netValue: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 14 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { color: GRAY, fontSize: 6.5, fontStyle: "italic" },
});

function formatPeso(value: string | null | undefined): string {
  if (!value) return "₱0.00";
  const num = parseFloat(value);
  return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function LineRow({
  label,
  value,
  index,
  negative,
}: {
  label: string;
  value: string | null | undefined;
  index: number;
  negative?: boolean;
}) {
  return (
    <View style={[styles.lineItem, index % 2 === 1 ? styles.lineItemAlt : {}]}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={negative ? styles.lineValueNeg : styles.lineValue}>
        {negative ? `(${formatPeso(value)})` : formatPeso(value)}
      </Text>
    </View>
  );
}

function PayslipPage({
  record,
  period,
  generatedAt,
}: {
  record: PayrollRecordWithEmployee;
  period: PayrollPeriod;
  generatedAt: string;
}) {
  const emp = record.employee;
  const mi = emp.middleName
    ? `, ${emp.firstName} ${emp.middleName.charAt(0)}.`
    : `, ${emp.firstName}`;
  const fullName = `${emp.lastName}${mi}`;
  const periodRange = `${formatDate(period.periodStart)} – ${formatDate(period.periodEnd)}`;

  const earningsLines = [
    { label: "Basic Pay", value: record.basicPay },
    { label: "RATA", value: record.rata },
    { label: "Longevity Pay", value: record.longevityPay },
    { label: "Overtime Pay", value: record.overtimePay },
    { label: "PERA", value: record.pera },
    { label: "Other Adjustments", value: record.otherEarnings },
  ];

  const deductionLines = [
    { label: "GSIS Personal", value: record.gsisPersonal },
    { label: "PhilHealth Personal", value: record.philhealthPersonal },
    { label: "Pag-IBIG Personal", value: record.pagibigPersonal },
    { label: "Withholding Tax", value: record.withholdingTax },
    { label: "Late Deduction", value: record.lateDeduction },
    { label: "Undertime Deduction", value: record.undertimeDeduction },
    { label: "Absence Deduction", value: record.absenceDeduction },
    { label: "Other Deductions", value: record.otherDeductions },
  ];

  return (
    <Page size="LETTER" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.sealPlaceholder}>
          <Text style={styles.sealText}>PCSO{"\n"}PH</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.agency}>
            PHILIPPINE CHARITY SWEEPSTAKES OFFICE
          </Text>
          <Text style={styles.agencySub}>
            Financial Services Department — Payroll Division
          </Text>
        </View>
        <View>
          <Text style={styles.payslipTitle}>PAYSLIP</Text>
          <Text style={styles.periodLabel}>{period.name}</Text>
          <Text style={styles.periodLabel}>
            Pay Date: {formatDate(period.payDate)}
          </Text>
        </View>
      </View>

      {/* Employee block */}
      <View style={styles.empBlock}>
        <View style={styles.empCol}>
          <Text style={styles.fieldLabel}>Employee Name</Text>
          <Text style={styles.fieldValue}>{fullName}</Text>
          <Text style={styles.fieldLabel}>Employee No.</Text>
          <Text style={styles.fieldValue}>{emp.employeeNo}</Text>
        </View>
        <View style={styles.empCol}>
          <Text style={styles.fieldLabel}>Position</Text>
          <Text style={styles.fieldValue}>{record.positionTitle}</Text>
          <Text style={styles.fieldLabel}>Office</Text>
          <Text style={styles.fieldValue}>{emp.officeName ?? "—"}</Text>
        </View>
        <View style={styles.empCol}>
          <Text style={styles.fieldLabel}>SG / Step</Text>
          <Text style={styles.fieldValue}>
            SG {record.salaryGrade} / Step {record.step}
          </Text>
          <Text style={styles.fieldLabel}>Period</Text>
          <Text style={styles.fieldValue}>{periodRange}</Text>
        </View>
      </View>

      {/* Two columns */}
      <View style={styles.columns}>
        <View style={styles.column}>
          <View style={styles.colHeader}>
            <Text style={styles.colHeaderText}>EARNINGS</Text>
          </View>
          {earningsLines.map((l, i) => (
            <LineRow key={l.label} label={l.label} value={l.value} index={i} />
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GROSS PAY</Text>
            <Text style={styles.totalValue}>{formatPeso(record.grossPay)}</Text>
          </View>
        </View>

        <View style={styles.column}>
          <View style={styles.colHeader}>
            <Text style={styles.colHeaderText}>DEDUCTIONS</Text>
          </View>
          {deductionLines.map((l, i) => (
            <LineRow
              key={l.label}
              label={l.label}
              value={l.value}
              index={i}
              negative
            />
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL DEDUCTIONS</Text>
            <Text style={styles.totalValue}>
              {formatPeso(record.totalDeductions)}
            </Text>
          </View>
        </View>
      </View>

      {/* Net Pay */}
      <View style={styles.netPayBox}>
        <Text style={styles.netLabel}>NET PAY</Text>
        <Text style={styles.netValue}>{formatPeso(record.netPay)}</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          This is a system-generated payslip. No signature required.
        </Text>
        <Text style={styles.footerText}>
          Generated: {new Date(generatedAt).toLocaleString("en-PH")}
        </Text>
      </View>
    </Page>
  );
}

interface BatchPayslipsDocumentProps {
  period: PayrollPeriod;
  records: PayrollRecordWithEmployee[];
  generatedAt?: string;
}

export function BatchPayslipsDocument({
  period,
  records,
  generatedAt,
}: BatchPayslipsDocumentProps) {
  const ts = generatedAt ?? new Date().toISOString();

  return (
    <Document
      title={`Batch Payslips - ${period.name}`}
      author="PCSO HRIS"
      subject="Batch Payslips"
    >
      {records.map((r) => (
        <PayslipPage key={r.id} record={r} period={period} generatedAt={ts} />
      ))}
    </Document>
  );
}
