/**
 * BIR Form 1601-C — Monthly Remittance Return of Income Taxes Withheld
 * on Compensation (React-PDF)
 *
 * Per BIR RR No. 11-2018 (TRAIN Law implementing rules).
 * Filed on or before the 10th day of the month following the month of withholding.
 *
 * Import dynamically in page components:
 *   const { Bir1601CPdf } = await import('@/components/pdf/bir-1601-c')
 */

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVY = '#0B2545';
const GOLD = '#C8A84B';
const CREAM = '#FAF4E6';
const BORDER = '#D1D5DB';
const BIR_BLUE = '#1D4ED8';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    padding: 32,
    color: '#111827',
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 12,
  },
  leftBlock: { flex: 1 },
  rightBlock: { width: 160, alignItems: 'flex-end' },
  birLogo: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: BIR_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  formCode: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: BIR_BLUE, lineHeight: 1.1 },
  formTitle: { fontSize: 7, color: '#374151', marginTop: 2, lineHeight: 1.4 },
  repNo: { fontSize: 6.5, color: '#6B7280', textTransform: 'uppercase' },
  repValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BIR_BLUE },
  divider: { height: 2, backgroundColor: BIR_BLUE, marginVertical: 8 },
  goldDivider: { height: 0.5, backgroundColor: GOLD, marginBottom: 10 },
  // Sections
  sectionTitle: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: BIR_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  // Field rows
  fieldGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  fieldBox: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 2,
    padding: 5,
  },
  fieldLabel: { fontSize: 5.5, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 1 },
  fieldValue: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#111827' },
  fieldValueSmall: { fontSize: 7, color: '#374151' },
  // Tax computation table
  computationBox: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 2,
    marginBottom: 10,
  },
  compRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.3,
    borderBottomColor: BORDER,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  compRowHighlight: { backgroundColor: CREAM },
  compRowTotal: { backgroundColor: NAVY },
  compLabel: { flex: 1, fontSize: 7, color: '#374151' },
  compLabelBold: { flex: 1, fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#111827' },
  compLabelWhite: { flex: 1, fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  compLineNo: { width: 20, fontSize: 6.5, color: '#9CA3AF' },
  compAmount: {
    width: 100,
    fontSize: 7,
    fontFamily: 'Courier',
    textAlign: 'right',
    color: '#1F2937',
  },
  compAmountBold: {
    width: 100,
    fontSize: 7,
    fontFamily: 'Courier-Bold',
    textAlign: 'right',
    color: '#111827',
  },
  compAmountGold: {
    width: 100,
    fontSize: 7,
    fontFamily: 'Courier-Bold',
    textAlign: 'right',
    color: GOLD,
  },
  // Signature block
  signatureBlock: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureLine: {
    borderTopWidth: 0.5,
    borderTopColor: '#374151',
    width: 180,
    paddingTop: 4,
  },
  signatureLabel: { fontSize: 6, color: '#6B7280', textTransform: 'uppercase' },
  signatureName: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 1 },
  // Footer
  pageNumber: {
    position: 'absolute',
    bottom: 14,
    right: 32,
    fontSize: 6,
    color: '#9CA3AF',
  },
  disclaimer: {
    position: 'absolute',
    bottom: 14,
    left: 32,
    fontSize: 6,
    color: '#9CA3AF',
  },
  // Note box
  noteBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 0.5,
    borderColor: '#D97706',
    borderRadius: 2,
    padding: 5,
    marginBottom: 8,
  },
  noteText: { fontSize: 6.5, color: '#92400E' },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Bir1601CProps {
  meta: {
    /** Calendar month covered, e.g. "January 2025" */
    periodLabel: string;
    /** YYYY-MM */
    yearMonth: string;
    /** Statutory due date, e.g. "February 10, 2025" */
    dueDate: string;
    agencyName: string;
    agencyAddress: string;
    tin: string;
    zipCode: string;
    generatedAt: string;
    preparedBy: string;
    certifiedBy: string;
  };
  computation: {
    /** Total compensation income paid this month */
    totalCompensation: string;
    /** Total non-taxable (mandatory deductions + exempt benefits) */
    totalNonTaxable: string;
    /** Taxable compensation = total - non-taxable */
    taxableCompensation: string;
    /** Income tax withheld per table */
    taxWithheld: string;
    /** Adjustments from prior periods */
    adjustments: string;
    /** Tax remitted in prior months of the quarter */
    taxRemittedPrior: string;
    /** Tax still to be remitted = withheld + adjustments - prior */
    taxStillDue: string;
    /** Number of payees (employees) */
    payeeCount: number;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Bir1601CPdf({ meta, computation }: Bir1601CProps) {
  return (
    <Document
      title={`BIR Form 1601-C — ${meta.periodLabel}`}
      author={meta.agencyName}
      subject="Monthly Remittance Return of Income Taxes Withheld on Compensation"
    >
      <Page size="LETTER" style={styles.page}>
        {/* BIR Header */}
        <View style={styles.headerRow}>
          <View style={styles.leftBlock}>
            <Text style={styles.birLogo}>Bureau of Internal Revenue</Text>
            <Text style={styles.formCode}>1601-C</Text>
            <Text style={styles.formTitle}>
              Monthly Remittance Return of Income Taxes{'\n'}
              Withheld on Compensation
            </Text>
          </View>

          <View style={styles.rightBlock}>
            <Text style={styles.repNo}>Return Period</Text>
            <Text style={styles.repValue}>{meta.periodLabel}</Text>
            <Text style={[styles.repNo, { marginTop: 4 }]}>Due Date</Text>
            <Text style={styles.repValue}>{meta.dueDate}</Text>
            <Text style={[styles.repNo, { marginTop: 4 }]}>Generated</Text>
            <Text style={styles.repValue}>{meta.generatedAt}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Employer Information */}
        <Text style={styles.sectionTitle}>Part I — Background Information (Employer)</Text>

        <View style={styles.fieldGrid}>
          <View style={[styles.fieldBox, { flex: 2 }]}>
            <Text style={styles.fieldLabel}>Name of Employer</Text>
            <Text style={styles.fieldValue}>{meta.agencyName}</Text>
          </View>
          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>Employer TIN</Text>
            <Text style={styles.fieldValue}>{meta.tin}</Text>
          </View>
          <View style={[styles.fieldBox, { width: 60 }]}>
            <Text style={styles.fieldLabel}>ZIP Code</Text>
            <Text style={styles.fieldValue}>{meta.zipCode}</Text>
          </View>
        </View>

        <View style={[styles.fieldGrid, { marginBottom: 12 }]}>
          <View style={[styles.fieldBox, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Registered Address</Text>
            <Text style={styles.fieldValueSmall}>{meta.agencyAddress}</Text>
          </View>
          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>Category of Withholding Agent</Text>
            <Text style={styles.fieldValue}>Government</Text>
          </View>
        </View>

        <View style={styles.goldDivider} />

        {/* Note */}
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            Statutory Deadline: 10th day of the month following the taxable month.
            Late filing is subject to surcharge, interest, and compromise penalty per Sec. 248–250 NIRC.
          </Text>
        </View>

        {/* Tax Computation — Part II */}
        <Text style={styles.sectionTitle}>Part II — Computation of Tax</Text>

        <View style={styles.computationBox}>
          {[
            {
              no: '1',
              label: 'Total Compensation Income Paid During the Month',
              value: computation.totalCompensation,
              bold: false,
            },
            {
              no: '2',
              label: 'Less: Non-Taxable Compensation (Mandatory Contributions + Exempt Benefits)',
              value: computation.totalNonTaxable,
              bold: false,
            },
            {
              no: '3',
              label: 'Taxable Compensation (Line 1 minus Line 2)',
              value: computation.taxableCompensation,
              bold: true,
              highlight: true,
            },
            {
              no: '4',
              label: 'Income Tax Withheld This Month (per BIR Tax Table)',
              value: computation.taxWithheld,
              bold: false,
            },
            {
              no: '5',
              label: 'Adjustments from Prior Periods (Over/Under)',
              value: computation.adjustments,
              bold: false,
            },
            {
              no: '6',
              label: 'Tax Remitted in Prior Months of the Quarter',
              value: computation.taxRemittedPrior,
              bold: false,
            },
            {
              no: '7',
              label: 'Number of Payees This Month',
              value: String(computation.payeeCount),
              bold: false,
              isCount: true,
            },
          ].map((row) => (
            <View
              key={row.no}
              style={[
                styles.compRow,
                row.highlight ? styles.compRowHighlight : {},
              ]}
            >
              <Text style={styles.compLineNo}>{row.no}</Text>
              <Text style={row.bold ? styles.compLabelBold : styles.compLabel}>
                {row.label}
              </Text>
              {row.isCount ? (
                <Text style={styles.compAmountBold}>{row.value}</Text>
              ) : (
                <Text style={row.bold ? styles.compAmountBold : styles.compAmount}>
                  {row.isCount ? row.value : fmt(row.value)}
                </Text>
              )}
            </View>
          ))}

          {/* Total row */}
          <View style={styles.compRowTotal}>
            <Text style={styles.compLineNo}> </Text>
            <Text style={styles.compLabelWhite}>
              TOTAL TAX STILL DUE / OVERPAYMENT (Line 4 + Line 5 − Line 6)
            </Text>
            <Text style={styles.compAmountGold}>{fmt(computation.taxStillDue)}</Text>
          </View>
        </View>

        {/* Signature block */}
        <View style={styles.signatureBlock}>
          <View>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{meta.preparedBy}</Text>
              <Text style={styles.signatureLabel}>
                Prepared by — Payroll / Accounting Officer
              </Text>
            </View>
          </View>
          <View>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{meta.certifiedBy}</Text>
              <Text style={styles.signatureLabel}>Authorized Signatory</Text>
            </View>
          </View>
          <View>
            <View style={styles.signatureLine}>
              <Text style={[styles.signatureName, { color: 'transparent' }]}>{'  '}</Text>
              <Text style={styles.signatureLabel}>Date / Stamp of Filing</Text>
            </View>
          </View>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
        <Text style={styles.disclaimer} fixed>
          Generated by Senate HRIS — Confidential — For Official Use Only
        </Text>
      </Page>
    </Document>
  );
}
