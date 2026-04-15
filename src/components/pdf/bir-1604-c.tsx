/**
 * BIR Form 1604-C — Annual Information Return of Income Taxes Withheld
 * on Compensation (Summary) (React-PDF)
 *
 * Filed on or before January 31 of the year following the calendar year covered.
 * This template renders the summary form page. The alphalist (Schedule 1) is
 * exported separately as a CSV via bir-alphalist.ts.
 *
 * Import dynamically:
 *   const { Bir1604CPdf } = await import('@/components/pdf/bir-1604-c')
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  leftHeader: { flex: 1 },
  rightHeader: { width: 150, alignItems: 'flex-end' },
  birTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: BIR_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formCode: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: BIR_BLUE },
  formTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    textTransform: 'uppercase',
    lineHeight: 1.4,
    marginTop: 2,
  },
  metaLabel: { fontSize: 5.5, color: '#9CA3AF', textTransform: 'uppercase' },
  metaValue: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: BIR_BLUE },
  blueDivider: { height: 1.5, backgroundColor: BIR_BLUE, marginVertical: 6 },
  goldDivider: { height: 0.5, backgroundColor: GOLD, marginBottom: 8 },
  sectionLabel: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: BIR_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginBottom: 5,
  },
  // Field grid
  twoCol: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  fieldBox: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingBottom: 2,
  },
  fieldLabel: { fontSize: 5.5, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 1 },
  fieldValue: { fontSize: 7.5, color: '#111827' },
  fieldValueBold: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#111827' },
  // Summary table
  summaryTable: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 2,
    marginBottom: 10,
  },
  summaryHead: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  summaryHeadLabel: {
    flex: 1,
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  summaryHeadAmt: {
    width: 110,
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderBottomWidth: 0.3,
    borderBottomColor: BORDER,
  },
  summaryRowAlt: { backgroundColor: CREAM },
  summaryLabel: { flex: 1, fontSize: 7, color: '#374151' },
  summaryLabelBold: { flex: 1, fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#111827' },
  summaryAmt: {
    width: 110,
    fontSize: 7,
    fontFamily: 'Courier',
    textAlign: 'right',
    color: '#1F2937',
  },
  summaryAmtBold: {
    width: 110,
    fontSize: 7,
    fontFamily: 'Courier-Bold',
    textAlign: 'right',
    color: '#111827',
  },
  grandTotalRow: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  grandTotalLabel: { flex: 1, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  grandTotalAmt: {
    width: 110,
    fontSize: 7.5,
    fontFamily: 'Courier-Bold',
    textAlign: 'right',
    color: GOLD,
  },
  // Payee breakdown
  payeeBox: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 2,
    padding: 8,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 12,
  },
  payeeCard: { flex: 1, alignItems: 'center' },
  payeeCardLabel: {
    fontSize: 6,
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 3,
    textAlign: 'center',
  },
  payeeCardValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: NAVY },
  // Certification
  certBox: {
    borderWidth: 0.5,
    borderColor: '#D97706',
    borderRadius: 2,
    backgroundColor: '#FFFBEB',
    padding: 6,
    marginBottom: 10,
  },
  certText: { fontSize: 6, color: '#78350F', lineHeight: 1.6 },
  // Alphalist note
  alphalistNote: {
    borderWidth: 0.5,
    borderColor: '#16A34A',
    borderRadius: 2,
    backgroundColor: '#F0FDF4',
    padding: 6,
    marginBottom: 10,
  },
  alphalistNoteText: { fontSize: 6.5, color: '#14532D', lineHeight: 1.5 },
  // Signature
  signatureRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  signatureLine: { borderTopWidth: 0.5, borderTopColor: '#374151', width: 160, paddingTop: 4 },
  signatureLabel: { fontSize: 5.5, color: '#6B7280', textTransform: 'uppercase' },
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
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Bir1604CProps {
  employer: {
    name: string;
    tin: string;
    address: string;
    zipCode: string;
  };
  period: {
    year: string;
    /** e.g. "January 31, 2025" */
    dueDate: string;
  };
  summary: {
    /** Total payees (employees) included in the alphalist */
    totalPayees: number;
    /** Sub-count: minimum wage earners */
    mweCount: number;
    /** Total gross compensation paid for the year */
    totalGrossCompensation: string;
    /** Total non-taxable compensation */
    totalNonTaxable: string;
    /** Total taxable compensation */
    totalTaxableCompensation: string;
    /** Aggregate tax due */
    totalTaxDue: string;
    /** Aggregate tax withheld */
    totalTaxWithheld: string;
    /** Net over/under remittance (+/-) */
    netOverUnder: string;
  };
  meta: {
    batchNo: string;
    generatedAt: string;
    preparedBy: string;
    certifiedBy: string;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Bir1604CPdf({ employer, period, summary, meta }: Bir1604CProps) {
  const netNum = parseFloat(summary.netOverUnder);
  const isOver = netNum > 0;

  return (
    <Document
      title={`BIR Form 1604-C — ${period.year} — ${employer.name}`}
      author={employer.name}
      subject="Annual Information Return of Income Taxes Withheld on Compensation"
    >
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.leftHeader}>
            <Text style={styles.birTitle}>Bureau of Internal Revenue</Text>
            <Text style={styles.formCode}>1604-C</Text>
            <Text style={styles.formTitle}>
              Annual Information Return of Income{'\n'}
              Taxes Withheld on Compensation
            </Text>
          </View>

          <View style={styles.rightHeader}>
            <Text style={styles.metaLabel}>Calendar Year</Text>
            <Text style={styles.metaValue}>{period.year}</Text>
            <Text style={[styles.metaLabel, { marginTop: 3 }]}>Due Date</Text>
            <Text style={styles.metaValue}>{period.dueDate}</Text>
            <Text style={[styles.metaLabel, { marginTop: 3 }]}>Batch No.</Text>
            <Text style={styles.metaValue}>{meta.batchNo}</Text>
            <Text style={[styles.metaLabel, { marginTop: 3 }]}>Generated</Text>
            <Text style={styles.metaValue}>{meta.generatedAt}</Text>
          </View>
        </View>

        <View style={styles.blueDivider} />

        {/* Employer */}
        <Text style={styles.sectionLabel}>Part I — Employer / Withholding Agent Information</Text>

        <View style={styles.twoCol}>
          <View style={[styles.fieldBox, { flex: 2 }]}>
            <Text style={styles.fieldLabel}>Name of Employer</Text>
            <Text style={styles.fieldValueBold}>{employer.name}</Text>
          </View>
          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>TIN</Text>
            <Text style={styles.fieldValueBold}>{employer.tin}</Text>
          </View>
          <View style={[styles.fieldBox, { width: 55 }]}>
            <Text style={styles.fieldLabel}>ZIP</Text>
            <Text style={styles.fieldValue}>{employer.zipCode}</Text>
          </View>
        </View>

        <View style={[styles.twoCol, { marginBottom: 10 }]}>
          <View style={[styles.fieldBox, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Registered Address</Text>
            <Text style={styles.fieldValue}>{employer.address}</Text>
          </View>
          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>Category</Text>
            <Text style={styles.fieldValue}>Government</Text>
          </View>
        </View>

        <View style={styles.goldDivider} />

        {/* Payee counts */}
        <Text style={styles.sectionLabel}>Part II — Payee Information Summary</Text>

        <View style={styles.payeeBox}>
          <View style={styles.payeeCard}>
            <Text style={styles.payeeCardLabel}>Total Payees (Alphalist)</Text>
            <Text style={styles.payeeCardValue}>{summary.totalPayees}</Text>
          </View>
          <View style={styles.payeeCard}>
            <Text style={styles.payeeCardLabel}>Minimum Wage Earners (MWE)</Text>
            <Text style={styles.payeeCardValue}>{summary.mweCount}</Text>
          </View>
          <View style={styles.payeeCard}>
            <Text style={styles.payeeCardLabel}>Purely Compensation (Non-MWE)</Text>
            <Text style={styles.payeeCardValue}>
              {summary.totalPayees - summary.mweCount}
            </Text>
          </View>
        </View>

        {/* Tax summary */}
        <Text style={styles.sectionLabel}>Part III — Annual Tax Summary</Text>

        <View style={styles.summaryTable}>
          <View style={styles.summaryHead}>
            <Text style={styles.summaryHeadLabel}>Particulars</Text>
            <Text style={styles.summaryHeadAmt}>Amount (PHP)</Text>
          </View>

          {[
            { label: 'Total Gross Compensation Income', value: summary.totalGrossCompensation, alt: true, bold: false },
            { label: 'Total Non-Taxable Compensation', value: summary.totalNonTaxable, alt: false, bold: false },
            { label: 'Total Taxable Compensation Income', value: summary.totalTaxableCompensation, alt: true, bold: true },
            { label: 'Total Income Tax Due', value: summary.totalTaxDue, alt: false, bold: false },
            { label: 'Total Income Tax Withheld', value: summary.totalTaxWithheld, alt: true, bold: false },
            {
              label: isOver ? 'Net Over-Remittance (Refundable)' : 'Net Under-Remittance (Payable)',
              value: Math.abs(netNum).toFixed(2),
              alt: false,
              bold: true,
            },
          ].map((row, idx) => (
            <View
              key={idx}
              style={[styles.summaryRow, row.alt ? styles.summaryRowAlt : {}]}
            >
              <Text style={row.bold ? styles.summaryLabelBold : styles.summaryLabel}>
                {row.label}
              </Text>
              <Text style={row.bold ? styles.summaryAmtBold : styles.summaryAmt}>
                {fmt(row.value)}
              </Text>
            </View>
          ))}

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL TAX WITHHELD FOR THE YEAR</Text>
            <Text style={styles.grandTotalAmt}>{fmt(summary.totalTaxWithheld)}</Text>
          </View>
        </View>

        {/* Alphalist note */}
        <View style={styles.alphalistNote}>
          <Text style={styles.alphalistNoteText}>
            Alphalist (Schedule 1 — Payees with Compensation Income) has been generated separately
            as a CSV file compatible with BIR eBIRForms / ADAS import. Reference batch: {meta.batchNo}.
          </Text>
        </View>

        {/* Certification */}
        <View style={styles.certBox}>
          <Text style={styles.certText}>
            I/We declare, under the penalties of perjury, that this return has been made in good
            faith, verified by me/us, and to the best of my/our knowledge and belief is true and
            correct, pursuant to the provisions of the National Internal Revenue Code, as amended,
            and the regulations issued under authority thereof.
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.signatureRow}>
          <View>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{meta.preparedBy}</Text>
              <Text style={styles.signatureLabel}>Prepared by</Text>
            </View>
          </View>
          <View>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{meta.certifiedBy}</Text>
              <Text style={styles.signatureLabel}>Authorized Signatory / Treasurer</Text>
            </View>
          </View>
          <View>
            <View style={styles.signatureLine}>
              <Text style={[styles.signatureName, { color: 'transparent' }]}>{'  '}</Text>
              <Text style={styles.signatureLabel}>Date Filed / BIR Stamp</Text>
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
