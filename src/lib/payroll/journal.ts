/**
 * Payroll journal entry builder — PAY-015 / TOR 1.8.16 (H-16).
 *
 * Pure: callers load the included, approved/paid payroll_records of ONE
 * period. All arithmetic is in integer centavos so the entry is exactly
 * balanced (debits == credits) or rejected — never "close enough".
 *
 * Regular entry:
 *   Dr Personnel Services – Gross Compensation        Σ gross pay
 *   Dr Personnel Services – Government Share          Σ GSIS + PhilHealth + Pag-IBIG employer
 *   Cr Personnel Services – Tardiness/Undertime/Absence Deductions
 *   Cr Due to BIR                                     Σ withholding tax
 *   Cr Due to GSIS                                    Σ personal + employer
 *   Cr Due to PhilHealth                              Σ personal + employer
 *   Cr Due to Pag-IBIG                                Σ personal + employer
 *   Cr Due to Other Payables (Loans/Other Deductions) Σ other deductions
 *   Cr Cash in Bank – Net Pay                         Σ net pay
 *
 * Collection-only runs (cash_advance) disburse nothing: the amortizations
 * collected are Dr Cash – Loan Collections / Cr Loans Receivable.
 *
 * gsis_life_insurance is ignored: it was never withheld from net pay (it was
 * not part of total deductions) and PLI is inside the 9%/12% shares.
 */

export interface JournalRecord {
  id: string;
  grossPay: string;
  withholdingTax: string;
  gsisPersonal: string;
  gsisEmployer: string;
  philhealthPersonal: string;
  philhealthEmployer: string;
  pagibigPersonal: string;
  pagibigEmployer: string;
  lateDeduction: string;
  undertimeDeduction: string;
  absenceDeduction: string;
  otherDeductions: string;
  netPay: string;
}

export interface JournalLine {
  account: string;
  type: "Debit" | "Credit";
  amount: string;
}

export type PayrollJournalBuild =
  | { ok: true; lines: JournalLine[]; totalDebit: string; totalCredit: string }
  | { ok: false; unbalancedRecordIds: string[] };

export const JOURNAL_ACCOUNTS = {
  grossCompensation: "Personnel Services – Gross Compensation",
  governmentShare: "Personnel Services – Government Share Contributions",
  attendanceDeductions:
    "Personnel Services – Tardiness/Undertime/Absence Deductions",
  dueBir: "Due to BIR",
  dueGsis: "Due to GSIS",
  duePhilHealth: "Due to PhilHealth",
  duePagIbig: "Due to Pag-IBIG",
  otherPayables: "Due to Other Payables (Loans/Other Deductions)",
  cashNetPay: "Cash in Bank – Net Pay",
  cashCollections: "Cash – Loan Collections",
  loansReceivable: "Loans Receivable – Cash Advances",
} as const;

/** Money string → integer centavos. Throws on non-numeric input. */
export function toCentavos(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new RangeError(`Invalid amount: ${value}`);
  return Math.round(n * 100);
}

function fromCentavos(c: number): string {
  return (c / 100).toFixed(2);
}

/**
 * Build the balanced journal for one period's records. Returns the IDs of
 * records whose own amounts do not reconcile (gross − deductions ≠ net,
 * e.g. after a manual override) instead of an unbalanced entry.
 */
export function buildPayrollJournal(
  records: readonly JournalRecord[],
  opts: { collectionOnly: boolean },
): PayrollJournalBuild {
  const t = {
    gross: 0,
    employer: 0,
    attendance: 0,
    bir: 0,
    gsis: 0,
    philHealth: 0,
    pagIbig: 0,
    other: 0,
    net: 0,
  };
  const unbalancedRecordIds: string[] = [];

  for (const r of records) {
    const gross = toCentavos(r.grossPay);
    const tax = toCentavos(r.withholdingTax);
    const gsisP = toCentavos(r.gsisPersonal);
    const gsisE = toCentavos(r.gsisEmployer);
    const phP = toCentavos(r.philhealthPersonal);
    const phE = toCentavos(r.philhealthEmployer);
    const piP = toCentavos(r.pagibigPersonal);
    const piE = toCentavos(r.pagibigEmployer);
    const attendance =
      toCentavos(r.lateDeduction) +
      toCentavos(r.undertimeDeduction) +
      toCentavos(r.absenceDeduction);
    const other = toCentavos(r.otherDeductions);
    const net = toCentavos(r.netPay);

    const withheld = tax + gsisP + phP + piP + attendance + other;
    // Collection-only records collect `other` from outside the run (no pay).
    const funded = opts.collectionOnly ? gross + other : gross;
    if (funded - withheld - net !== 0) {
      unbalancedRecordIds.push(r.id);
      continue;
    }

    t.gross += gross;
    t.employer += gsisE + phE + piE;
    t.attendance += attendance;
    t.bir += tax;
    t.gsis += gsisP + gsisE;
    t.philHealth += phP + phE;
    t.pagIbig += piP + piE;
    t.other += other;
    t.net += net;
  }

  if (unbalancedRecordIds.length > 0) return { ok: false, unbalancedRecordIds };

  const A = JOURNAL_ACCOUNTS;
  const raw: Array<[string, JournalLine["type"], number]> = [
    [A.grossCompensation, "Debit", t.gross],
    [A.governmentShare, "Debit", t.employer],
    [A.attendanceDeductions, "Credit", t.attendance],
    [A.dueBir, "Credit", t.bir],
    [A.dueGsis, "Credit", t.gsis],
    [A.duePhilHealth, "Credit", t.philHealth],
    [A.duePagIbig, "Credit", t.pagIbig],
    opts.collectionOnly
      ? [A.loansReceivable, "Credit", t.other]
      : [A.otherPayables, "Credit", t.other],
    [A.cashNetPay, "Credit", t.net],
  ];
  if (opts.collectionOnly) raw.push([A.cashCollections, "Debit", t.other]);

  let debit = 0;
  let credit = 0;
  const lines: JournalLine[] = [];
  for (const [account, type, cents] of raw) {
    if (cents === 0) continue;
    if (type === "Debit") debit += cents;
    else credit += cents;
    lines.push({ account, type, amount: fromCentavos(cents) });
  }

  // Holds by construction when every record reconciles; kept as a guard.
  if (debit !== credit) {
    throw new Error(
      `Payroll journal out of balance: debit ${fromCentavos(debit)} vs credit ${fromCentavos(credit)}`,
    );
  }

  return {
    ok: true,
    lines,
    totalDebit: fromCentavos(debit),
    totalCredit: fromCentavos(credit),
  };
}
