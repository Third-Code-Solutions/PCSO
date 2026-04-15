/**
 * Senate-branded payslip — React-PDF template.
 * Matches layout spec: Senate seal, two-column earnings/deductions, net pay in gold.
 */
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from '@react-pdf/renderer';
import type { PayrollRecord, PayrollPeriod } from '@/lib/db/schema';

// ─── Styles ───────────────────────────────────────────────────────────────────

const NAVY = '#0B2545';
const GOLD = '#C8A84B';
const CREAM = '#FAF4E6';
const GRAY = '#6B7280';
const BORDER = '#E5E7EB';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
    padding: 36,
    fontSize: 9,
    color: '#111827',
  },
  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 12,
    marginBottom: 12,
    gap: 12,
  },
  sealPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: NAVY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sealText: {
    color: GOLD,
    fontSize: 7,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
  },
  headerTextBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 8,
    color: GRAY,
    marginTop: 2,
  },
  payslipTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    textAlign: 'right',
  },
  periodLabel: {
    fontSize: 8,
    color: GRAY,
    textAlign: 'right',
    marginTop: 2,
  },
  // ── Employee Block ──────────────────────────────────────────────────────────
  employeeBlock: {
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 4,
    padding: 10,
    marginBottom: 14,
  },
  employeeGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  employeeCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 7,
    color: GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginBottom: 8,
  },
  // ── Two-column body ─────────────────────────────────────────────────────────
  columns: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
  column: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    overflow: 'hidden',
  },
  colHeader: {
    backgroundColor: NAVY,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  colHeaderText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  lineItemAlt: {
    backgroundColor: '#F9FAFB',
  },
  lineLabel: {
    color: '#374151',
    flex: 1,
  },
  lineValue: {
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
  },
  lineValueNeg: {
    color: '#DC2626',
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: NAVY,
  },
  totalLabel: {
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  totalValue: {
    color: GOLD,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  // ── Net Pay ─────────────────────────────────────────────────────────────────
  netPayBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: NAVY,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
  },
  netPayLabel: {
    color: GOLD,
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    letterSpacing: 2,
  },
  netPayValue: {
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
  },
  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    color: GRAY,
    fontSize: 7,
    fontStyle: 'italic',
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPeso(value: string | null | undefined): string {
  if (!value) return '₱0.00';
  const num = parseFloat(value);
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PayslipEmployee {
  employeeNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  positionTitle: string;
  officeName: string | null;
  salaryGrade: number;
  step: number;
}

interface PayslipDocumentProps {
  record: PayrollRecord;
  period: PayrollPeriod;
  employee: PayslipEmployee;
  generatedAt?: string;
}

// ─── Line Item Component ──────────────────────────────────────────────────────

function EarningLine({
  label,
  value,
  index,
}: {
  label: string;
  value: string | null | undefined;
  index: number;
}) {
  return (
    <View style={[styles.lineItem, index % 2 === 1 ? styles.lineItemAlt : {}]}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{formatPeso(value)}</Text>
    </View>
  );
}

function DeductionLine({
  label,
  value,
  index,
}: {
  label: string;
  value: string | null | undefined;
  index: number;
}) {
  return (
    <View style={[styles.lineItem, index % 2 === 1 ? styles.lineItemAlt : {}]}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValueNeg}>({formatPeso(value)})</Text>
    </View>
  );
}

// ─── Document ─────────────────────────────────────────────────────────────────

export function PayslipDocument({
  record,
  period,
  employee,
  generatedAt,
}: PayslipDocumentProps) {
  const fullName = [employee.lastName, employee.firstName, employee.middleName]
    .filter(Boolean)
    .join(', ');

  const periodRange = `${formatDate(period.periodStart)} – ${formatDate(period.periodEnd)}`;
  const genTimestamp = generatedAt
    ? new Date(generatedAt).toLocaleString('en-PH')
    : new Date().toLocaleString('en-PH');

  const earningsLines = [
    { label: 'Basic Pay', value: record.basicPay },
    { label: 'RATA (Rep. & Trans.)', value: record.rata },
    { label: 'Longevity Pay', value: record.longevityPay },
    { label: 'Overtime Pay', value: record.overtimePay },
    { label: 'PERA', value: record.pera },
    { label: 'Other Adjustments', value: record.otherEarnings },
  ];

  const deductionLines = [
    { label: 'GSIS Personal', value: record.gsisPersonal },
    { label: 'PhilHealth Personal', value: record.philhealthPersonal },
    { label: 'Pag-IBIG Personal', value: record.pagibigPersonal },
    { label: 'Withholding Tax', value: record.withholdingTax },
    { label: 'Late Deduction', value: record.lateDeduction },
    { label: 'Undertime Deduction', value: record.undertimeDeduction },
    { label: 'Absence Deduction', value: record.absenceDeduction },
    { label: 'Other Deductions', value: record.otherDeductions },
  ];

  return (
    <Document
      title={`Payslip - ${fullName} - ${period.name}`}
      author="Senate of the Philippines HRIS"
      subject="Official Payslip"
    >
      <Page size="LETTER" style={styles.page}>
        {/* ── Header ────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.sealPlaceholder}>
            <Text style={styles.sealText}>SENATE{'\n'}PH</Text>
          </View>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle}>SENATE OF THE PHILIPPINES</Text>
            <Text style={styles.headerSubtitle}>
              Financial Services Department — Payroll Division
            </Text>
            <Text style={styles.headerSubtitle}>
              GSIS Building, Roxas Boulevard, Pasay City, Metro Manila
            </Text>
          </View>
          <View>
            <Text style={styles.payslipTitle}>PAYSLIP</Text>
            <Text style={styles.periodLabel}>Period: {period.name}</Text>
            <Text style={styles.periodLabel}>Pay Date: {formatDate(period.payDate)}</Text>
          </View>
        </View>

        {/* ── Employee Block ─────────────────────────────────────────── */}
        <View style={styles.employeeBlock}>
          <View style={styles.employeeGrid}>
            <View style={styles.employeeCol}>
              <Text style={styles.fieldLabel}>Employee Name</Text>
              <Text style={styles.fieldValue}>{fullName}</Text>
              <Text style={styles.fieldLabel}>Employee No.</Text>
              <Text style={styles.fieldValue}>{employee.employeeNo}</Text>
            </View>
            <View style={styles.employeeCol}>
              <Text style={styles.fieldLabel}>Position Title</Text>
              <Text style={styles.fieldValue}>{employee.positionTitle}</Text>
              <Text style={styles.fieldLabel}>Office / Division</Text>
              <Text style={styles.fieldValue}>{employee.officeName ?? '—'}</Text>
            </View>
            <View style={styles.employeeCol}>
              <Text style={styles.fieldLabel}>Salary Grade / Step</Text>
              <Text style={styles.fieldValue}>
                SG {employee.salaryGrade} / Step {employee.step}
              </Text>
              <Text style={styles.fieldLabel}>Period Covered</Text>
              <Text style={styles.fieldValue}>{periodRange}</Text>
            </View>
          </View>
        </View>

        {/* ── Two-Column Body ────────────────────────────────────────── */}
        <View style={styles.columns}>
          {/* Earnings column */}
          <View style={styles.column}>
            <View style={styles.colHeader}>
              <Text style={styles.colHeaderText}>EARNINGS</Text>
            </View>
            {earningsLines.map((line, i) => (
              <EarningLine key={line.label} label={line.label} value={line.value} index={i} />
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GROSS PAY</Text>
              <Text style={styles.totalValue}>{formatPeso(record.grossPay)}</Text>
            </View>
          </View>

          {/* Deductions column */}
          <View style={styles.column}>
            <View style={styles.colHeader}>
              <Text style={styles.colHeaderText}>DEDUCTIONS</Text>
            </View>
            {deductionLines.map((line, i) => (
              <DeductionLine
                key={line.label}
                label={line.label}
                value={line.value}
                index={i}
              />
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL DEDUCTIONS</Text>
              <Text style={styles.totalValue}>{formatPeso(record.totalDeductions)}</Text>
            </View>
          </View>
        </View>

        {/* ── Net Pay ───────────────────────────────────────────────── */}
        <View style={styles.netPayBox}>
          <Text style={styles.netPayLabel}>NET PAY</Text>
          <Text style={styles.netPayValue}>{formatPeso(record.netPay)}</Text>
        </View>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This is a system-generated payslip. No signature required.
          </Text>
          <Text style={styles.footerText}>Generated: {genTimestamp}</Text>
        </View>
      </Page>
    </Document>
  );
}
