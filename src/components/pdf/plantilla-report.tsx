'use client';

/**
 * PlantillaReport — React-PDF export of the official plantilla.
 *
 * Produces a PDF matching the standard government plantilla of personnel format:
 * Item No | Position | SG | Authorized Salary | Incumbent | Status
 *
 * Usage: pass `rows` from getPlantillaPositions() and call PDFDownloadLink
 * or BlobProvider from @react-pdf/renderer.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { PlantillaPositionRow } from '@/app/(dashboard)/plantilla/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlantillaReportProps {
  rows: PlantillaPositionRow[];
  title?: string;
  subtitle?: string;
  asOf?: string;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const NAVY = '#0B2545';
const GOLD = '#C8A84B';
const CREAM = '#FAF4E6';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 30,
    color: '#1a1a2e',
  },

  // Header
  header: {
    marginBottom: 16,
    borderBottom: `2px solid ${GOLD}`,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orgName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reportTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 2,
  },
  asOf: {
    fontSize: 7,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 2,
  },

  // Summary row
  summary: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    backgroundColor: CREAM,
    padding: 8,
    borderRadius: 4,
  },
  summaryItem: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
  summaryLabel: {
    fontSize: 7,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },

  // Table
  table: {
    width: '100%',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    color: '#ffffff',
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottom: '0.5px solid #e5e7eb',
  },
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },

  // Column widths (total ~535 pt for letter landscape minus margins)
  colItemNo: { width: 50 },
  colPosition: { width: 160 },
  colSG: { width: 28 },
  colSalary: { width: 80 },
  colIncumbent: { width: 130 },
  colOffice: { width: 75 },
  colStatus: { width: 42 },

  // Cell text
  cellText: {
    fontSize: 8,
    color: '#111827',
    flexWrap: 'wrap',
  },
  cellTextMuted: {
    fontSize: 7,
    color: '#6b7280',
    marginTop: 1,
  },
  cellTextMono: {
    fontFamily: 'Courier',
    fontSize: 7,
    color: '#374151',
  },
  statusFilled: {
    color: '#065f46',
    fontFamily: 'Helvetica-Bold',
  },
  statusVacant: {
    color: '#92400e',
    fontFamily: 'Helvetica-Bold',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#9ca3af',
    borderTop: '0.5px solid #e5e7eb',
    paddingTop: 4,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPeso(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(num);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TableHeader() {
  return (
    <View style={styles.tableHead}>
      <View style={styles.colItemNo}>
        <Text>Item No.</Text>
      </View>
      <View style={styles.colPosition}>
        <Text>Position Title</Text>
      </View>
      <View style={styles.colSG}>
        <Text>SG</Text>
      </View>
      <View style={styles.colSalary}>
        <Text>Auth. Salary</Text>
      </View>
      <View style={styles.colOffice}>
        <Text>Office</Text>
      </View>
      <View style={styles.colIncumbent}>
        <Text>Incumbent</Text>
      </View>
      <View style={styles.colStatus}>
        <Text>Status</Text>
      </View>
    </View>
  );
}

function TableBodyRow({
  row,
  index,
}: {
  row: PlantillaPositionRow;
  index: number;
}) {
  return (
    <View style={[styles.tableRow, index % 2 !== 0 ? styles.tableRowAlt : {}]}>
      <View style={styles.colItemNo}>
        <Text style={styles.cellTextMono}>{row.itemNo}</Text>
      </View>
      <View style={styles.colPosition}>
        <Text style={styles.cellText}>{row.positionTitle}</Text>
      </View>
      <View style={styles.colSG}>
        <Text style={styles.cellTextMono}>{row.salaryGrade}</Text>
      </View>
      <View style={styles.colSalary}>
        <Text style={styles.cellTextMono}>{formatPeso(row.authorizedSalary)}</Text>
      </View>
      <View style={styles.colOffice}>
        <Text style={styles.cellText}>{row.officeCode}</Text>
      </View>
      <View style={styles.colIncumbent}>
        {row.employeeName ? (
          <>
            <Text style={styles.cellText}>{row.employeeName}</Text>
            {row.employeeNo && (
              <Text style={styles.cellTextMuted}>{row.employeeNo}</Text>
            )}
          </>
        ) : (
          <Text style={styles.cellTextMuted}>—</Text>
        )}
      </View>
      <View style={styles.colStatus}>
        <Text style={row.isFilled ? styles.statusFilled : styles.statusVacant}>
          {row.isFilled ? 'Filled' : 'Vacant'}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function PlantillaReport({
  rows,
  title = 'Plantilla of Personnel',
  subtitle = 'Senate of the Philippines',
  asOf,
}: PlantillaReportProps) {
  const total = rows.length;
  const filled = rows.filter((r) => r.isFilled).length;
  const vacant = total - filled;
  const fillRate = total > 0 ? Math.round((filled / total) * 100) : 0;
  const generatedOn = asOf ?? new Date().toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.orgName}>{subtitle}</Text>
              <Text style={styles.reportTitle}>{title}</Text>
            </View>
            <Text style={styles.asOf}>As of {generatedOn}</Text>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{total}</Text>
            <Text style={styles.summaryLabel}>Total Positions</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{filled}</Text>
            <Text style={styles.summaryLabel}>Filled</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{vacant}</Text>
            <Text style={styles.summaryLabel}>Vacant</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{fillRate}%</Text>
            <Text style={styles.summaryLabel}>Fill Rate</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <TableHeader />
          {rows.map((row, idx) => (
            <TableBodyRow key={row.id} row={row} index={idx} />
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Senate of the Philippines HRIS — {title}</Text>
          <Text render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          } />
        </View>
      </Page>
    </Document>
  );
}
