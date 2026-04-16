/**
 * CSC Leave Card (Leave Card / Leave Record) PDF
 *
 * Rendered using @react-pdf/renderer.
 *
 * Layout mirrors the official CSC Leave Card / Individual Leave Record
 * maintained by HR offices per CSC Omnibus Rules on Leave, Rule XIV, §53.
 *
 * The card shows:
 *  - Employee details
 *  - Opening balances (carry-over from prior year)
 *  - Monthly accrual schedule
 *  - Leave usages (applied leaves) listed chronologically
 *  - Running balance per entry
 *  - Terminal leave estimate
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { LeaveTypeCode } from '@/lib/constants/leave-types';

// ---------------------------------------------------------------------------
// Public prop types (exported so _client.tsx can reference them)
// ---------------------------------------------------------------------------

export interface LeaveUsageEntryForCard {
  id: string;
  leaveTypeCode: LeaveTypeCode;
  leaveTypeName: string;
  dateFrom: string;
  dateTo: string;
  daysDeducted: number;
  status: string;
}

export interface AccrualMonthEntryForCard {
  month: number;
  monthLabel: string;
  vlAdded: number;
  slAdded: number;
  vlRunning: number | null;
  slRunning: number | null;
}

export interface LeaveCardEmployee {
  firstName: string;
  lastName: string;
  middleName?: string;
  employeeNo: string;
  positionTitle: string;
  officeName: string;
  dateHired: string;
  /** Monthly basic salary as formatted string, e.g. "30,531.00" */
  monthlyBasicSalary: string;
}

export interface LeaveCardCredits {
  year: number;
  vlBalance: number;
  slBalance: number;
  vlEarned: number;
  slEarned: number;
  vlCarryOver: number;
  slCarryOver: number;
  vlForfeited: number;
}

export interface LeaveCardTerminalEstimate {
  vlBalance: number;
  slBalance: number;
  slEffectiveDays: number;
  totalEffectiveDays: number;
  dailyRate: number;
  terminalLeavePay: number;
}

export interface LeaveCardProps {
  employee: LeaveCardEmployee;
  credits: LeaveCardCredits;
  usageEntries: LeaveUsageEntryForCard[];
  accrualSchedule: AccrualMonthEntryForCard[];
  terminalEstimate: LeaveCardTerminalEstimate | null;
  /** Name of the certifying HR officer (optional). */
  certifyingOfficer?: string;
}

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const NAVY = '#0B2545';
const GOLD = '#C8A84B';
const CREAM = '#FAF4E6';
const BORDER = '#d1d5db';
const LIGHT = '#f9fafb';
const GREEN = '#065f46';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    padding: 28,
    color: '#111827',
    backgroundColor: '#ffffff',
  },

  // ── Header ──
  header: {
    marginBottom: 6,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  headerAgency: {
    fontSize: 6.5,
    color: '#6b7280',
  },
  headerTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
  headerSub: {
    fontSize: 7,
    color: '#374151',
    marginTop: 1,
  },
  formRef: {
    fontSize: 6.5,
    color: GOLD,
    textAlign: 'right',
  },
  goldRule: {
    borderBottomWidth: 1.5,
    borderBottomColor: GOLD,
    marginBottom: 6,
  },

  // ── Section header ──
  sectionHeader: {
    backgroundColor: NAVY,
    color: CREAM,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 2.5,
    marginBottom: 4,
    marginTop: 6,
  },

  // ── Employee info grid ──
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 4,
  },
  infoCell: {
    flex: 1,
    minWidth: '28%',
  },
  infoLabel: {
    fontSize: 6,
    color: '#6b7280',
    marginBottom: 1,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingBottom: 1.5,
  },

  // ── Tables ──
  table: {
    borderWidth: 0.5,
    borderColor: BORDER,
    marginBottom: 6,
  },
  tHead: {
    flexDirection: 'row',
    backgroundColor: LIGHT,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  tRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.3,
    borderBottomColor: BORDER,
  },
  tRowAlt: {
    backgroundColor: '#f9fafb',
  },
  tCell: {
    flex: 1,
    padding: 2.5,
    fontSize: 6.5,
    borderRightWidth: 0.3,
    borderRightColor: BORDER,
  },
  tCellHead: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 6,
    color: '#374151',
  },
  tCellRight: {
    textAlign: 'right',
  },
  tCellCenter: {
    textAlign: 'center',
  },
  tCellBold: {
    fontFamily: 'Helvetica-Bold',
  },
  tCellNavy: {
    color: NAVY,
    fontFamily: 'Helvetica-Bold',
  },
  tCellGreen: {
    color: GREEN,
    fontFamily: 'Helvetica-Bold',
  },
  tCellAmber: {
    color: '#92400e',
  },
  tCellFuture: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },

  // ── Summary boxes ──
  summaryRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  summaryBox: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 5,
    borderRadius: 3,
  },
  summaryBoxHighlight: {
    borderColor: NAVY,
    backgroundColor: '#eff6ff',
  },
  summaryLabel: {
    fontSize: 6,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    tabularNums: true,
  },
  summaryValueGreen: {
    color: GREEN,
  },
  summaryValuePeso: {
    color: NAVY,
    fontSize: 9,
  },

  // ── Terminal leave ──
  terminalBox: {
    borderWidth: 0.5,
    borderColor: GOLD,
    backgroundColor: '#fffbeb',
    padding: 6,
    marginBottom: 6,
    borderRadius: 2,
  },
  terminalTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: NAVY,
    marginBottom: 4,
  },
  terminalRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 2,
  },
  terminalCell: {
    flex: 1,
  },
  terminalLabel: {
    fontSize: 6,
    color: '#92400e',
  },
  terminalValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
  terminalDisclaimer: {
    fontSize: 6,
    color: '#6b7280',
    marginTop: 3,
    fontStyle: 'italic',
  },

  // ── Signature block ──
  signatureArea: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 40,
  },
  signatureCol: {
    width: 160,
    alignItems: 'center',
  },
  signatureLine: {
    borderBottomWidth: 0.8,
    borderBottomColor: '#374151',
    width: '100%',
    height: 18,
    marginBottom: 2,
  },
  signatureLabel: {
    fontSize: 6,
    color: '#6b7280',
    textAlign: 'center',
  },

  // ── Footer ──
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 3,
    marginTop: 8,
  },
  footerText: {
    fontSize: 5.5,
    color: '#9ca3af',
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt3(n: number): string {
  return n.toFixed(3);
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function fmtPeso(amount: number): string {
  return `\u20B1 ${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

// ---------------------------------------------------------------------------
// PDF Document
// ---------------------------------------------------------------------------

export function LeaveCard({
  employee,
  credits,
  usageEntries,
  accrualSchedule,
  terminalEstimate,
  certifyingOfficer,
}: LeaveCardProps) {
  const fullName = [employee.lastName, employee.firstName, employee.middleName]
    .filter(Boolean)
    .join(', ');

  // Compute running balances for usage history display
  let runningVl = credits.vlCarryOver + credits.vlEarned;
  let runningSl = credits.slCarryOver + credits.slEarned;
  const usageWithRunning = usageEntries.map((entry) => {
    if (entry.leaveTypeCode === 'VL') {
      runningVl = Math.max(0, runningVl - entry.daysDeducted);
    } else if (entry.leaveTypeCode === 'SL') {
      runningSl = Math.max(0, runningSl - entry.daysDeducted);
    }
    return { ...entry, runningVl, runningSl };
  });

  return (
    <Document
      title={`Leave Card — ${fullName} — ${credits.year}`}
      author="Senate of the Philippines HRIS"
      subject="Individual Leave Record (Leave Card)"
      keywords="leave,card,CSC,leave record,Senate HRIS"
    >
      <Page size="LETTER" orientation="landscape" style={styles.page}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerAgency}>Republic of the Philippines</Text>
              <Text style={styles.headerTitle}>SENATE OF THE PHILIPPINES</Text>
              <Text style={styles.headerSub}>Human Resources Information System</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.formRef}>INDIVIDUAL LEAVE RECORD (Leave Card)</Text>
              <Text style={styles.formRef}>Per CSC Omnibus Rules, Rule XIV §53</Text>
              <Text style={[styles.formRef, { marginTop: 2 }]}>
                Calendar Year: {credits.year}
              </Text>
            </View>
          </View>
          <View style={styles.goldRule} />
        </View>

        {/* ── I. Employee Information ─────────────────────────────────────── */}
        <SectionHeader>I. EMPLOYEE INFORMATION</SectionHeader>
        <View style={styles.infoGrid}>
          {[
            { label: 'Name (Last, First, Middle)', value: fullName },
            { label: 'Employee No.', value: employee.employeeNo },
            { label: 'Position Title', value: employee.positionTitle },
            { label: 'Office / Department', value: employee.officeName },
            {
              label: 'Date Hired',
              value: employee.dateHired ? fmtDate(employee.dateHired) : '—',
            },
            {
              label: 'Monthly Basic Salary',
              value: `\u20B1 ${employee.monthlyBasicSalary}`,
            },
          ].map(({ label, value }) => (
            <View key={label} style={styles.infoCell}>
              <Text style={styles.infoLabel}>{label}</Text>
              <Text style={styles.infoValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* ── II. Opening Balances ────────────────────────────────────────── */}
        <SectionHeader>{`II. OPENING BALANCES — ${credits.year}`}</SectionHeader>
        <View style={styles.summaryRow}>
          {[
            {
              label: `VL Carry-over from ${credits.year - 1}`,
              value: fmt3(credits.vlCarryOver),
              navy: true,
            },
            {
              label: `SL Carry-over from ${credits.year - 1}`,
              value: fmt3(credits.slCarryOver),
              green: true,
            },
            {
              label: 'VL Earned this Year',
              value: fmt3(credits.vlEarned),
              navy: true,
            },
            {
              label: 'SL Earned this Year',
              value: fmt3(credits.slEarned),
              green: true,
            },
            credits.vlForfeited > 0
              ? {
                  label: 'VL Forfeited (cap exceeded)',
                  value: fmt3(credits.vlForfeited),
                  amber: true,
                }
              : {
                  label: 'VL Forfeited',
                  value: '—',
                },
            {
              label: `Current VL Balance`,
              value: fmt3(credits.vlBalance),
              navy: true,
              highlight: true,
            },
            {
              label: `Current SL Balance`,
              value: fmt3(credits.slBalance),
              green: true,
              highlight: true,
            },
          ].map(({ label, value, navy, green, amber, highlight }) => (
            <View
              key={label}
              style={[styles.summaryBox, highlight ? styles.summaryBoxHighlight : {}]}
            >
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text
                style={[
                  styles.summaryValue,
                  green ? styles.summaryValueGreen : {},
                  amber ? { color: '#92400e' } : {},
                ]}
              >
                {value}
              </Text>
            </View>
          ))}
        </View>

        {/* ── III. Monthly Accrual Schedule ──────────────────────────────── */}
        <SectionHeader>{`III. MONTHLY ACCRUAL SCHEDULE — ${credits.year}`}</SectionHeader>
        <View style={styles.table}>
          <View style={styles.tHead}>
            {['Month', 'VL Added', 'SL Added', 'VL Running Total', 'SL Running Total', 'Notes'].map(
              (h) => (
                <View key={h} style={styles.tCell}>
                  <Text style={styles.tCellHead}>{h}</Text>
                </View>
              ),
            )}
          </View>
          {accrualSchedule.map((row, i) => {
            const isFuture = row.vlRunning === null;
            const noAccrual = row.vlAdded === 0 && !isFuture;
            return (
              <View key={row.month} style={[styles.tRow, i % 2 === 0 ? styles.tRowAlt : {}]}>
                <View style={styles.tCell}>
                  <Text style={isFuture ? styles.tCellFuture : undefined}>{row.monthLabel}</Text>
                </View>
                <View style={[styles.tCell, styles.tCellRight]}>
                  <Text style={isFuture ? styles.tCellFuture : noAccrual ? styles.tCellAmber : styles.tCellNavy}>
                    {isFuture ? '—' : row.vlAdded > 0 ? `+${row.vlAdded.toFixed(3)}` : '0.000'}
                  </Text>
                </View>
                <View style={[styles.tCell, styles.tCellRight]}>
                  <Text style={isFuture ? styles.tCellFuture : noAccrual ? styles.tCellAmber : styles.tCellGreen}>
                    {isFuture ? '—' : row.slAdded > 0 ? `+${row.slAdded.toFixed(3)}` : '0.000'}
                  </Text>
                </View>
                <View style={[styles.tCell, styles.tCellRight]}>
                  <Text style={isFuture ? styles.tCellFuture : styles.tCellNavy}>
                    {row.vlRunning !== null ? fmt3(row.vlRunning) : '—'}
                  </Text>
                </View>
                <View style={[styles.tCell, styles.tCellRight]}>
                  <Text style={isFuture ? styles.tCellFuture : styles.tCellGreen}>
                    {row.slRunning !== null ? fmt3(row.slRunning) : '—'}
                  </Text>
                </View>
                <View style={styles.tCell}>
                  <Text style={styles.tCellFuture}>
                    {isFuture
                      ? 'Projected (not yet credited)'
                      : noAccrual
                        ? 'No accrual (pre-hire)'
                        : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── IV. Leave Usage History ─────────────────────────────────────── */}
        <SectionHeader>{`IV. LEAVE USAGE — APPROVED APPLICATIONS (${credits.year})`}</SectionHeader>
        {usageWithRunning.length === 0 ? (
          <Text style={{ fontSize: 7, color: '#6b7280', marginBottom: 6 }}>
            {`No VL or SL applications recorded for ${credits.year}.`}
          </Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tHead}>
              {[
                'Date From',
                'Date To',
                'Leave Type',
                'Days Deducted',
                'VL Balance After',
                'SL Balance After',
                'Status',
              ].map((h) => (
                <View key={h} style={styles.tCell}>
                  <Text style={styles.tCellHead}>{h}</Text>
                </View>
              ))}
            </View>
            {usageWithRunning.map((entry, i) => (
              <View key={entry.id} style={[styles.tRow, i % 2 === 0 ? styles.tRowAlt : {}]}>
                <View style={styles.tCell}>
                  <Text>{fmtDate(entry.dateFrom)}</Text>
                </View>
                <View style={styles.tCell}>
                  <Text>{fmtDate(entry.dateTo)}</Text>
                </View>
                <View style={styles.tCell}>
                  <Text style={entry.leaveTypeCode === 'VL' ? styles.tCellNavy : styles.tCellGreen}>
                    {entry.leaveTypeName}
                  </Text>
                </View>
                <View style={[styles.tCell, styles.tCellRight]}>
                  <Text style={styles.tCellBold}>({entry.daysDeducted.toFixed(3)})</Text>
                </View>
                <View style={[styles.tCell, styles.tCellRight]}>
                  <Text style={styles.tCellNavy}>{fmt3(entry.runningVl)}</Text>
                </View>
                <View style={[styles.tCell, styles.tCellRight]}>
                  <Text style={styles.tCellGreen}>{fmt3(entry.runningSl)}</Text>
                </View>
                <View style={styles.tCell}>
                  <Text
                    style={{
                      fontSize: 6,
                      color: entry.status === 'approved' ? '#065f46' : '#6b7280',
                    }}
                  >
                    {entry.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── V. Terminal Leave Estimate ──────────────────────────────────── */}
        {terminalEstimate && (
          <>
            <SectionHeader>V. TERMINAL LEAVE ESTIMATE (CSC Omnibus Rules, Rule XVI §56)</SectionHeader>
            <View style={styles.terminalBox}>
              <Text style={styles.terminalTitle}>
                {`Terminal Leave Estimate — as of end of ${credits.year}`}
              </Text>
              <View style={styles.terminalRow}>
                {[
                  { label: 'VL Balance', value: `${fmt3(terminalEstimate.vlBalance)} days` },
                  {
                    label: 'SL @ 50% (CSC Rule)',
                    value: `${fmt3(terminalEstimate.slEffectiveDays)} days`,
                  },
                  {
                    label: 'Total Effective Days',
                    value: `${fmt3(terminalEstimate.totalEffectiveDays)} days`,
                  },
                  {
                    label: 'Daily Rate (Salary ÷ 22)',
                    value: fmtPeso(terminalEstimate.dailyRate),
                  },
                  {
                    label: 'Estimated Terminal Leave Pay',
                    value: fmtPeso(terminalEstimate.terminalLeavePay),
                    highlight: true,
                  },
                ].map(({ label, value }) => (
                  <View key={label} style={styles.terminalCell}>
                    <Text style={styles.terminalLabel}>{label}</Text>
                    <Text style={styles.terminalValue}>{value}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.terminalDisclaimer}>
                Formula: (VL balance + SL balance × 0.50) × (Monthly Basic Salary ÷ 22).
                This is an estimate only. Actual amount computed at time of separation/retirement.
                Tax treatment depends on nature of separation.
              </Text>
            </View>
          </>
        )}

        {/* ── VI. Certification ──────────────────────────────────────────── */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureCol}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Employee Signature over Printed Name / Date</Text>
          </View>
          <View style={styles.signatureCol}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>
              {certifyingOfficer ?? 'Authorized HR Officer'}
            </Text>
            <Text style={[styles.signatureLabel, { marginTop: 1 }]}>
              Certifying Officer — Chief, Human Resources
            </Text>
          </View>
        </View>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {`Generated by Senate HRIS — ${new Date().toLocaleDateString('en-PH')}`}
          </Text>
          <Text style={styles.footerText}>
            {`Leave Card · Calendar Year ${credits.year} · ${fullName} (${employee.employeeNo})`}
          </Text>
          <Text style={styles.footerText}>
            Per CSC Omnibus Rules on Leave, MC No. 41, s. 1998
          </Text>
        </View>
      </Page>
    </Document>
  );
}
