/**
 * GSIS Remittance List — official print format (React-PDF)
 *
 * Mirrors the GSIS Remittance List template used by government agencies.
 * Columns (required order):
 *   Employee No | GSIS No | Name | Monthly Salary Credit |
 *   Personal Share | Employer Share | Life Insurance | Total
 *
 * This component is rendered server-side via @react-pdf/renderer.
 * Import dynamically in page components to avoid SSR issues.
 */

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';
import type { GsisRemittanceLine } from '@/lib/db/schema/gsis';

// ─── Styles ───────────────────────────────────────────────────────────────────

const NAVY = '#0B2545';
const GOLD = '#C8A84B';
const CREAM = '#FAF4E6';
const BORDER = '#D1D5DB';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    padding: 28,
    color: '#111827',
  },
  // Header section
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  agencyBlock: {
    flexDirection: 'column',
    gap: 2,
  },
  agencyName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
  agencySubtitle: {
    fontSize: 7,
    color: '#6B7280',
  },
  titleBlock: {
    alignItems: 'center',
    flex: 1,
  },
  formTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formSubtitle: {
    fontSize: 7,
    color: '#374151',
    marginTop: 1,
  },
  metaBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  metaLabel: {
    fontSize: 6.5,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
  // Divider
  divider: {
    height: 1.5,
    backgroundColor: GOLD,
    marginBottom: 8,
  },
  // Table
  table: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 2,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  tableHeadCell: {
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.3,
    borderBottomColor: BORDER,
  },
  tableRowAlt: {
    backgroundColor: CREAM,
  },
  tableCell: {
    paddingHorizontal: 5,
    paddingVertical: 3.5,
    fontSize: 7,
    color: '#1F2937',
  },
  tableCellMono: {
    paddingHorizontal: 5,
    paddingVertical: 3.5,
    fontSize: 6.5,
    fontFamily: 'Courier',
    color: '#374151',
  },
  tableCellRight: {
    paddingHorizontal: 5,
    paddingVertical: 3.5,
    fontSize: 7,
    textAlign: 'right',
    fontFamily: 'Courier',
    color: '#1F2937',
  },
  tableCellRightBold: {
    paddingHorizontal: 5,
    paddingVertical: 3.5,
    fontSize: 7,
    textAlign: 'right',
    fontFamily: 'Courier-Bold',
    color: '#111827',
  },
  totalsRow: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  totalsLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: '#FFFFFF',
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  totalsValue: {
    fontFamily: 'Courier-Bold',
    fontSize: 7,
    color: GOLD,
    textAlign: 'right',
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  // Footer
  signatureBlock: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureLine: {
    borderTopWidth: 0.5,
    borderTopColor: '#374151',
    width: 160,
    paddingTop: 4,
  },
  signatureLabel: {
    fontSize: 6.5,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  signatureName: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginBottom: 1,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 14,
    right: 28,
    fontSize: 6,
    color: '#9CA3AF',
  },
  disclaimer: {
    position: 'absolute',
    bottom: 14,
    left: 28,
    fontSize: 6,
    color: '#9CA3AF',
  },
});

// ─── Column widths (must sum to ~100%) ────────────────────────────────────────

const COL = {
  no:       '5%',
  empNo:    '9%',
  gsisNo:   '11%',
  name:     '24%',
  msc:      '13%',
  personal: '11%',
  employer: '11%',
  lifeIns:  '9%',
  total:    '7%',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface GsisRemittanceListProps {
  lines: GsisRemittanceLine[];
  meta: {
    agencyName: string;
    periodLabel: string;
    batchNo: string;
    periodStart: string;
    periodEnd: string;
    generatedAt: string;
    preparedBy: string;
    certifiedBy: string;
  };
  totals: {
    personalShare: string;
    employerShare: string;
    lifeInsurance: string;
    total: string;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GsisRemittanceListPdf({
  lines,
  meta,
  totals,
}: GsisRemittanceListProps) {
  return (
    <Document
      title={`GSIS Remittance List — ${meta.periodLabel}`}
      author={meta.agencyName}
      subject="GSIS Remittance List"
    >
      <Page size="LEGAL" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.agencyBlock}>
            <Text style={styles.agencyName}>{meta.agencyName}</Text>
            <Text style={styles.agencySubtitle}>Republic of the Philippines</Text>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.formTitle}>GSIS Remittance List</Text>
            <Text style={styles.formSubtitle}>
              Per Republic Act No. 8291 (GSIS Act of 1997)
            </Text>
          </View>

          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Batch No.</Text>
            <Text style={styles.metaValue}>{meta.batchNo}</Text>
            <Text style={[styles.metaLabel, { marginTop: 4 }]}>Period</Text>
            <Text style={styles.metaValue}>{meta.periodLabel}</Text>
            <Text style={[styles.metaLabel, { marginTop: 4 }]}>Generated</Text>
            <Text style={styles.metaValue}>{meta.generatedAt}</Text>
          </View>
        </View>

        {/* Gold divider */}
        <View style={styles.divider} />

        {/* Table */}
        <View style={styles.table}>
          {/* Header row */}
          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadCell, { width: COL.no }]}>#</Text>
            <Text style={[styles.tableHeadCell, { width: COL.empNo }]}>Emp. No.</Text>
            <Text style={[styles.tableHeadCell, { width: COL.gsisNo }]}>GSIS No.</Text>
            <Text style={[styles.tableHeadCell, { width: COL.name }]}>Name</Text>
            <Text style={[styles.tableHeadCell, { width: COL.msc, textAlign: 'right' }]}>
              Monthly Salary Credit
            </Text>
            <Text style={[styles.tableHeadCell, { width: COL.personal, textAlign: 'right' }]}>
              Personal Share
            </Text>
            <Text style={[styles.tableHeadCell, { width: COL.employer, textAlign: 'right' }]}>
              Employer Share
            </Text>
            <Text style={[styles.tableHeadCell, { width: COL.lifeIns, textAlign: 'right' }]}>
              Life Ins.
            </Text>
            <Text style={[styles.tableHeadCell, { width: COL.total, textAlign: 'right' }]}>
              Total
            </Text>
          </View>

          {/* Data rows */}
          {lines.map((line, idx) => (
            <View
              key={line.id}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableCell, { width: COL.no, color: '#9CA3AF' }]}>
                {idx + 1}
              </Text>
              <Text style={[styles.tableCellMono, { width: COL.empNo }]}>
                {line.employeeNo}
              </Text>
              <Text style={[styles.tableCellMono, { width: COL.gsisNo }]}>
                {line.gsisNo}
              </Text>
              <Text style={[styles.tableCell, { width: COL.name }]}>
                {line.employeeName}
              </Text>
              <Text style={[styles.tableCellRight, { width: COL.msc }]}>
                {fmt(line.monthlySalaryCredit)}
              </Text>
              <Text style={[styles.tableCellRight, { width: COL.personal }]}>
                {fmt(line.personalShare)}
              </Text>
              <Text style={[styles.tableCellRight, { width: COL.employer }]}>
                {fmt(line.employerShare)}
              </Text>
              <Text style={[styles.tableCellRight, { width: COL.lifeIns }]}>
                {fmt(line.lifeInsurance)}
              </Text>
              <Text style={[styles.tableCellRightBold, { width: COL.total }]}>
                {fmt(line.total)}
              </Text>
            </View>
          ))}

          {/* Totals row */}
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, { width: `calc(${COL.no} + ${COL.empNo} + ${COL.gsisNo} + ${COL.name} + ${COL.msc})` }]}>
              {`TOTAL (${lines.length} employee${lines.length !== 1 ? 's' : ''})`}
            </Text>
            <Text style={[styles.totalsValue, { width: COL.personal }]}>
              {fmt(totals.personalShare)}
            </Text>
            <Text style={[styles.totalsValue, { width: COL.employer }]}>
              {fmt(totals.employerShare)}
            </Text>
            <Text style={[styles.totalsValue, { width: COL.lifeIns }]}>
              {fmt(totals.lifeInsurance)}
            </Text>
            <Text style={[styles.totalsValue, { width: COL.total }]}>
              {fmt(totals.total)}
            </Text>
          </View>
        </View>

        {/* Signature block */}
        <View style={styles.signatureBlock}>
          <View>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{meta.preparedBy}</Text>
              <Text style={styles.signatureLabel}>Prepared by — HR / Payroll Officer</Text>
            </View>
          </View>
          <View>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{meta.certifiedBy}</Text>
              <Text style={styles.signatureLabel}>Certified Correct</Text>
            </View>
          </View>
          <View>
            <View style={styles.signatureLine}>
              <Text style={[styles.signatureName, { color: 'transparent' }]}>{'  '}</Text>
              <Text style={styles.signatureLabel}>Received by — GSIS Representative</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
        <Text style={styles.disclaimer} fixed>
          Generated by Senate HRIS — Confidential — For Official Use Only
        </Text>
      </Page>
    </Document>
  );
}
