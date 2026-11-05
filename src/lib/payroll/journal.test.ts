import { describe, it, expect } from "vitest";
import { computeFullPayroll } from "@/lib/utils/payroll";
import {
  buildPayrollJournal,
  JOURNAL_ACCOUNTS,
  toCentavos,
  type JournalRecord,
} from "./journal";

function fromResult(
  id: string,
  r: ReturnType<typeof computeFullPayroll>,
): JournalRecord {
  return {
    id,
    grossPay: r.earnings.grossPay,
    withholdingTax: r.deductions.withholdingTax,
    gsisPersonal: r.deductions.gsis.personal,
    gsisEmployer: r.deductions.gsis.employer,
    philhealthPersonal: r.deductions.philHealth.personal,
    philhealthEmployer: r.deductions.philHealth.employer,
    pagibigPersonal: r.deductions.pagIBIG.personal,
    pagibigEmployer: r.deductions.pagIBIG.employer,
    lateDeduction: r.deductions.lateDeduction,
    undertimeDeduction: r.deductions.undertimeDeduction,
    absenceDeduction: r.deductions.absenceDeduction,
    otherDeductions: r.deductions.otherDeductions,
    netPay: r.netPay,
  };
}

function compute(
  salary: number,
  attendance: Partial<{ late: number; ut: number; abs: number }> = {},
  loan = 0,
) {
  return computeFullPayroll({
    employee: {
      id: "e",
      appointmentType: "permanent",
      salaryGrade: 15,
      step: 1,
      yearsInService: 3,
      authorizedMonthlySalary: salary,
    },
    period: {
      type: "semi-monthly",
      start: new Date("2026-01-01"),
      end: new Date("2026-01-15"),
    },
    attendance: {
      lateMinutes: attendance.late ?? 0,
      undertimeMinutes: attendance.ut ?? 0,
      absenceDays: attendance.abs ?? 0,
      approvedOvertimeHours: 0,
    },
    includeRata: false,
    ...(loan > 0
      ? {
          otherAdjustments: [
            { name: "loan", amount: loan, type: "deduction" as const },
          ],
        }
      : {}),
  });
}

function sides(lines: { type: string; amount: string }[]) {
  let debit = 0;
  let credit = 0;
  for (const l of lines) {
    if (l.type === "Debit") debit += toCentavos(l.amount);
    else credit += toCentavos(l.amount);
  }
  return { debit, credit };
}

describe("buildPayrollJournal (H-16)", () => {
  it("balances computed records including employer shares, loans and attendance", () => {
    const records = [
      fromResult("a", compute(36_619)),
      fromResult(
        "b",
        compute(51_357.33, { late: 37, ut: 12, abs: 1 }, 1_234.56),
      ),
      fromResult("c", compute(129_015)),
    ];

    const built = buildPayrollJournal(records, { collectionOnly: false });
    if (!built.ok) throw new Error("expected balanced journal");

    const { debit, credit } = sides(built.lines);
    expect(debit).toBe(credit);
    expect(built.totalDebit).toBe(built.totalCredit);

    const employer = records.reduce(
      (s, r) =>
        s +
        toCentavos(r.gsisEmployer) +
        toCentavos(r.philhealthEmployer) +
        toCentavos(r.pagibigEmployer),
      0,
    );
    const share = built.lines.find(
      (l) => l.account === JOURNAL_ACCOUNTS.governmentShare,
    );
    expect(share?.type).toBe("Debit");
    expect(toCentavos(share!.amount)).toBe(employer);

    const other = built.lines.find(
      (l) => l.account === JOURNAL_ACCOUNTS.otherPayables,
    );
    expect(other?.amount).toBe("1234.56");
  });

  it("rejects records whose own amounts do not reconcile (e.g. manual override)", () => {
    const good = fromResult("good", compute(40_000));
    const overridden = { ...good, id: "bad", netPay: "99999.99" };
    const built = buildPayrollJournal([good, overridden], {
      collectionOnly: false,
    });
    expect(built).toEqual({ ok: false, unbalancedRecordIds: ["bad"] });
  });

  it("books collection-only (cash advance) runs as cash collected vs receivable", () => {
    const zero = "0.00";
    const record: JournalRecord = {
      id: "ca",
      grossPay: zero,
      withholdingTax: zero,
      gsisPersonal: zero,
      gsisEmployer: zero,
      philhealthPersonal: zero,
      philhealthEmployer: zero,
      pagibigPersonal: zero,
      pagibigEmployer: zero,
      lateDeduction: zero,
      undertimeDeduction: zero,
      absenceDeduction: zero,
      otherDeductions: "2500.00",
      netPay: zero,
    };
    const built = buildPayrollJournal([record], { collectionOnly: true });
    expect(built).toEqual({
      ok: true,
      lines: [
        {
          account: JOURNAL_ACCOUNTS.loansReceivable,
          type: "Credit",
          amount: "2500.00",
        },
        {
          account: JOURNAL_ACCOUNTS.cashCollections,
          type: "Debit",
          amount: "2500.00",
        },
      ],
      totalDebit: "2500.00",
      totalCredit: "2500.00",
    });
    // The same record in a regular run does not reconcile.
    expect(buildPayrollJournal([record], { collectionOnly: false }).ok).toBe(
      false,
    );
  });

  it("ignores the legacy phantom GSIS life-insurance amount", () => {
    const r = fromResult("a", compute(30_000));
    const legacy = { ...r, gsisLifeInsurance: "50.00" } as JournalRecord;
    const built = buildPayrollJournal([legacy], { collectionOnly: false });
    expect(built.ok).toBe(true);
  });
});
