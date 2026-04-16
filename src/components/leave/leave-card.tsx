/**
 * CSC Leave Card (Form 6 / Individual Leave Record) — CSV generator.
 *
 * NOTE: This file used to render a PDF via @react-pdf/renderer but React 19
 * compatibility issues force us to ship the Leave Card as CSV instead.
 * See CLAUDE.md handoff — Agent 7.
 *
 * The CSV mirrors the CSC Form 6 / Individual Leave Record maintained by HR
 * offices per CSC Omnibus Rules on Leave (Rule XIV §53).
 *
 * Sections produced (blank rows as separators):
 *  I.   Header (agency + employee info)
 *  II.  Opening balances (carry-over, earned, forfeited, current)
 *  III. Monthly accrual schedule with cumulative VL/SL running balance
 *  IV.  Leave usage (approved applications) with running balances
 *  V.   Terminal leave estimate
 *  VI.  Certification footer
 *
 * All functions are pure and safe to call on the server or client. No DOM
 * access, no heavy dependencies, works in any runtime.
 */

import type { LeaveTypeCode } from '@/lib/constants/leave-types';

// ---------------------------------------------------------------------------
// Public prop types
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
// Helpers
// ---------------------------------------------------------------------------

function fmt3(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3) : '';
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function fmtPeso(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  return `PHP ${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * CSV cell escaping per RFC 4180.
 * Quote fields containing comma, quote, CR, LF, or leading/trailing whitespace.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  const needsQuote = /[",\r\n]/.test(s) || /^\s|\s$/.test(s);
  if (!needsQuote) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function csvRow(cells: Array<unknown>): string {
  return cells.map(csvCell).join(',');
}

// ---------------------------------------------------------------------------
// CSV generator (Form 6)
// ---------------------------------------------------------------------------

/**
 * Produces a CSC Form 6 (Individual Leave Record) compatible CSV string.
 *
 * The CSV is UTF-8 with a BOM prefix so Excel opens it with correct
 * encoding for the peso sign and accented names.
 *
 * This function is deterministic and pure — same inputs always produce the
 * same bytes. Safe to call during server rendering if needed.
 */
export function generateLeaveCardCSV(props: LeaveCardProps): string {
  const { employee, credits, usageEntries, accrualSchedule, terminalEstimate, certifyingOfficer } =
    props;

  const fullName = [employee.lastName, employee.firstName, employee.middleName]
    .filter(Boolean)
    .join(', ');

  const rows: string[] = [];

  // ── Header ───────────────────────────────────────────────────────────────
  rows.push(csvRow(['REPUBLIC OF THE PHILIPPINES']));
  rows.push(csvRow(['SENATE OF THE PHILIPPINES']));
  rows.push(csvRow(['Human Resources Information System']));
  rows.push(csvRow(['INDIVIDUAL LEAVE RECORD (CSC Form 6)']));
  rows.push(csvRow(['Per CSC Omnibus Rules on Leave, Rule XIV Section 53']));
  rows.push(csvRow([`Calendar Year: ${credits.year}`]));
  rows.push('');

  // ── I. Employee Information ──────────────────────────────────────────────
  rows.push(csvRow(['I. EMPLOYEE INFORMATION']));
  rows.push(csvRow(['Field', 'Value']));
  rows.push(csvRow(['Name (Last, First, Middle)', fullName]));
  rows.push(csvRow(['Employee No.', employee.employeeNo]));
  rows.push(csvRow(['Position Title', employee.positionTitle]));
  rows.push(csvRow(['Office / Department', employee.officeName]));
  rows.push(csvRow(['Date Hired', employee.dateHired ? fmtDate(employee.dateHired) : '']));
  rows.push(csvRow(['Monthly Basic Salary', `PHP ${employee.monthlyBasicSalary}`]));
  rows.push('');

  // ── II. Opening Balances ─────────────────────────────────────────────────
  rows.push(csvRow([`II. OPENING BALANCES — ${credits.year}`]));
  rows.push(csvRow(['Item', 'Days']));
  rows.push(csvRow([`VL Carry-over from ${credits.year - 1}`, fmt3(credits.vlCarryOver)]));
  rows.push(csvRow([`SL Carry-over from ${credits.year - 1}`, fmt3(credits.slCarryOver)]));
  rows.push(csvRow(['VL Earned this year', fmt3(credits.vlEarned)]));
  rows.push(csvRow(['SL Earned this year', fmt3(credits.slEarned)]));
  rows.push(csvRow(['VL Forfeited (cap exceeded)', fmt3(credits.vlForfeited)]));
  rows.push(csvRow(['Current VL Balance', fmt3(credits.vlBalance)]));
  rows.push(csvRow(['Current SL Balance', fmt3(credits.slBalance)]));
  rows.push('');

  // ── III. Monthly Accrual Schedule ────────────────────────────────────────
  rows.push(csvRow([`III. MONTHLY ACCRUAL SCHEDULE — ${credits.year}`]));
  rows.push(
    csvRow(['Month', 'VL Added', 'SL Added', 'VL Running Total', 'SL Running Total', 'Notes']),
  );
  for (const row of accrualSchedule) {
    const isFuture = row.vlRunning === null;
    const noAccrual = !isFuture && row.vlAdded === 0;
    rows.push(
      csvRow([
        row.monthLabel,
        isFuture ? '' : row.vlAdded.toFixed(3),
        isFuture ? '' : row.slAdded.toFixed(3),
        row.vlRunning !== null ? fmt3(row.vlRunning) : '',
        row.slRunning !== null ? fmt3(row.slRunning) : '',
        isFuture ? 'Projected (not yet credited)' : noAccrual ? 'No accrual (pre-hire)' : '',
      ]),
    );
  }
  rows.push('');

  // ── IV. Leave Usage ──────────────────────────────────────────────────────
  rows.push(csvRow([`IV. LEAVE USAGE — APPROVED APPLICATIONS (${credits.year})`]));
  rows.push(
    csvRow([
      'Date From',
      'Date To',
      'Leave Type',
      'Days Deducted',
      'VL Balance After',
      'SL Balance After',
      'Status',
    ]),
  );

  if (usageEntries.length === 0) {
    rows.push(csvRow([`No VL or SL applications recorded for ${credits.year}.`]));
  } else {
    // Compute running balances starting from total earned + carry-over, then
    // deducting each approved application chronologically. This gives HR an
    // auditable trail matching the paper Form 6.
    let runningVl = credits.vlCarryOver + credits.vlEarned;
    let runningSl = credits.slCarryOver + credits.slEarned;

    for (const entry of usageEntries) {
      if (entry.leaveTypeCode === 'VL') {
        runningVl = Math.max(0, runningVl - entry.daysDeducted);
      } else if (entry.leaveTypeCode === 'SL') {
        runningSl = Math.max(0, runningSl - entry.daysDeducted);
      }
      rows.push(
        csvRow([
          fmtDate(entry.dateFrom),
          fmtDate(entry.dateTo),
          entry.leaveTypeName,
          `(${entry.daysDeducted.toFixed(3)})`,
          fmt3(runningVl),
          fmt3(runningSl),
          entry.status.toUpperCase(),
        ]),
      );
    }
  }
  rows.push('');

  // ── V. Terminal Leave Estimate ───────────────────────────────────────────
  if (terminalEstimate) {
    rows.push(csvRow(['V. TERMINAL LEAVE ESTIMATE (CSC Omnibus Rules, Rule XVI Section 56)']));
    rows.push(csvRow(['Item', 'Value']));
    rows.push(csvRow(['VL Balance (days)', fmt3(terminalEstimate.vlBalance)]));
    rows.push(csvRow(['SL @ 50% (days)', fmt3(terminalEstimate.slEffectiveDays)]));
    rows.push(csvRow(['Total Effective Days', fmt3(terminalEstimate.totalEffectiveDays)]));
    rows.push(csvRow(['Daily Rate (Salary / 22)', fmtPeso(terminalEstimate.dailyRate)]));
    rows.push(csvRow(['Estimated Terminal Leave Pay', fmtPeso(terminalEstimate.terminalLeavePay)]));
    rows.push(
      csvRow([
        'Formula: (VL + SL x 0.50) x (Monthly Basic Salary / 22). Estimate only — actual computed at separation.',
      ]),
    );
    rows.push('');
  }

  // ── VI. Certification ────────────────────────────────────────────────────
  rows.push(csvRow(['VI. CERTIFICATION']));
  rows.push(csvRow(['Employee Signature over Printed Name / Date', '____________________']));
  rows.push(
    csvRow([
      certifyingOfficer ?? 'Authorized HR Officer',
      'Certifying Officer — Chief, Human Resources',
    ]),
  );
  rows.push('');

  // ── Footer ───────────────────────────────────────────────────────────────
  rows.push(
    csvRow([
      `Generated by Senate HRIS on ${new Date().toLocaleDateString('en-PH')}`,
    ]),
  );
  rows.push(
    csvRow([`Calendar Year ${credits.year} — ${fullName} (${employee.employeeNo})`]),
  );
  rows.push(csvRow(['Per CSC Omnibus Rules on Leave, MC No. 41, s. 1998']));

  // Join with CRLF (RFC 4180), prepend UTF-8 BOM for Excel compatibility.
  return '\ufeff' + rows.join('\r\n') + '\r\n';
}

/**
 * Returns a standard filename for the generated Leave Card CSV.
 */
export function leaveCardFilename(props: LeaveCardProps): string {
  const safeNo = (props.employee.employeeNo || 'employee').replace(/[^A-Za-z0-9_-]/g, '_');
  return `LeaveCard_Form6_${safeNo}_${props.credits.year}.csv`;
}
