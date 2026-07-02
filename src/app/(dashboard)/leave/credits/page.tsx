/**
 * /leave/credits — Personal leave credit summary for the logged-in employee
 *
 * Sections:
 *  1. Credit Balance card (VL/SL) + breakdown + years-in-service
 *  2. Monthly accrual schedule (last 12 months, or full calendar year)
 *  3. Usage history (last 12 approved VL/SL leaves for the selected year)
 *  4. Terminal leave estimate (upon retirement/separation)
 *  5. Download Leave Card (Form 6 CSV) button
 */

import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { CreditBalanceCard } from "@/components/leave/credit-balance-card";
import { getLeaveCreditBalance } from "@/app/(dashboard)/leave/queries";
import { getCreditsHistoryForYear } from "@/app/(dashboard)/leave/credits/queries";
import {
  computeTerminalLeave,
  formatTerminalLeavePay,
} from "@/lib/utils/leave/terminal";
import { getAuthorizedSalary } from "@/lib/utils/payroll/salary";
import { db } from "@/lib/db";
import { salaryGrades } from "@/lib/db/schema";
import { and, desc, eq, lte } from "drizzle-orm";
import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { PrintLeaveCard } from "./_client";
import type { LeaveCardProps } from "@/components/leave/leave-card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Leave Credits",
};

// Last-resort monthly basic salary for the terminal-leave estimate when the
// employee's grade/step cannot be resolved against either salary table.
// SG-15 Step 1 ≈ ₱30,531.
const FALLBACK_MONTHLY_SALARY = 30_531;

/**
 * Resolve the authorized monthly basic salary for a grade/step — same rule as
 * the payroll engine: the admin-maintained salary_grades table (latest
 * effective row on or before today) is preferred, falling back to the static
 * SSL V table, then to a placeholder for unresolvable legacy data.
 */
async function resolveMonthlyBasicSalary(
  salaryGrade: number,
  step: number,
): Promise<number> {
  if (
    !Number.isInteger(salaryGrade) ||
    !Number.isInteger(step) ||
    salaryGrade < 1 ||
    step < 1
  ) {
    return FALLBACK_MONTHLY_SALARY;
  }

  const today = new Date().toISOString().slice(0, 10);
  const [row] = await db
    .select({ monthlySalary: salaryGrades.monthlySalary })
    .from(salaryGrades)
    .where(
      and(
        eq(salaryGrades.grade, salaryGrade),
        eq(salaryGrades.step, step),
        lte(salaryGrades.effectiveDate, today),
      ),
    )
    .orderBy(desc(salaryGrades.effectiveDate))
    .limit(1);

  if (row) {
    const fromTable = Number(row.monthlySalary);
    if (Number.isFinite(fromTable) && fromTable > 0) return fromTable;
  }

  try {
    return getAuthorizedSalary(salaryGrade, step);
  } catch {
    // Grade/step outside SSL V bounds (legacy/non-plantilla data).
    return FALLBACK_MONTHLY_SALARY;
  }
}

export default async function MyLeaveCreditsPage() {
  const user = await requireAuth();

  if (!user.employeeId) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm">No employee record is linked to your account.</p>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();

  // Run data loads in parallel to keep TTFB tight.
  const [creditBalance, history, supabase] = await Promise.all([
    getLeaveCreditBalance(user.employeeId, currentYear),
    getCreditsHistoryForYear(user.employeeId, currentYear),
    createServerClient(),
  ]);

  const { data: empData } = await supabase
    .from("employees")
    .select(
      "first_name, last_name, middle_name, employee_no, position_title, date_hired, office_id, salary_grade, step",
    )
    .eq("id", user.employeeId)
    .single();

  // SSL/step salary lookup for the terminal-leave money value.
  const monthlyBasicSalary = await resolveMonthlyBasicSalary(
    Number(empData?.salary_grade ?? 0),
    Number(empData?.step ?? 0),
  );

  let officeName = "";
  if (empData?.office_id) {
    const { data: office } = await supabase
      .from("offices")
      .select("name")
      .eq("id", String(empData.office_id))
      .single();
    officeName = String(office?.name ?? "");
  }

  const terminalEstimate = creditBalance
    ? computeTerminalLeave({
        vlBalance: creditBalance.vlBalance,
        slBalance: creditBalance.slBalance,
        monthlyBasicSalary,
      })
    : null;

  const hireDate = empData?.date_hired
    ? new Date(String(empData.date_hired))
    : null;
  const yearsInService = hireDate
    ? Math.floor(
        (Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
      )
    : 0;

  // Latest 12 approved VL/SL leaves for this year (most recent first).
  const usageRecent = [...history.usageEntries]
    .sort((a, b) => (a.dateFrom < b.dateFrom ? 1 : -1))
    .slice(0, 12);

  // Accrual "last 12 months" for the current year: show realised accruals
  // chronologically, newest last (so the running balance reads naturally).
  const accrualTimeline = history.accrualSchedule;

  // Build the CSC Form 6 CSV payload from what we already loaded — no extra
  // queries, everything is derived from `history` + balance + employee row.
  const leaveCardProps: LeaveCardProps = {
    employee: {
      firstName: String(empData?.first_name ?? ""),
      lastName: String(empData?.last_name ?? ""),
      middleName:
        typeof empData?.middle_name === "string"
          ? empData.middle_name
          : undefined,
      employeeNo: String(empData?.employee_no ?? ""),
      positionTitle: String(empData?.position_title ?? ""),
      officeName,
      dateHired:
        typeof empData?.date_hired === "string" ? empData.date_hired : "",
      monthlyBasicSalary: monthlyBasicSalary.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    },
    credits: {
      year: currentYear,
      vlBalance: creditBalance?.vlBalance ?? 0,
      slBalance: creditBalance?.slBalance ?? 0,
      vlEarned: creditBalance?.vlEarned ?? 0,
      slEarned: creditBalance?.slEarned ?? 0,
      vlCarryOver: history.vlCarryOver,
      slCarryOver: history.slCarryOver,
      vlForfeited: history.vlForfeited,
    },
    usageEntries: history.usageEntries.map((e) => ({
      id: e.id,
      leaveTypeCode: e.leaveTypeCode,
      leaveTypeName: e.leaveTypeName,
      dateFrom: e.dateFrom,
      dateTo: e.dateTo,
      daysDeducted: e.daysDeducted,
      status: e.status,
    })),
    accrualSchedule: history.accrualSchedule.map((a) => ({
      month: a.month,
      monthLabel: a.monthLabel,
      vlAdded: a.vlAdded,
      slAdded: a.slAdded,
      vlRunning: a.vlRunning,
      slRunning: a.slRunning,
    })),
    terminalEstimate,
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <RealtimeBoundary tables={["leave_applications", "leave_credits"]} />
      <PageHeader
        title="My Leave Credits"
        description={`Leave credit summary for ${currentYear}.`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leave", href: "/leave" },
          { label: "My Credits" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PrintLeaveCard leaveCardProps={leaveCardProps} />
            <Button
              size="sm"
              asChild
              className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
            >
              <Link href="/leave/apply">Apply for Leave</Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CreditBalanceCard
          vlBalance={creditBalance?.vlBalance ?? 0}
          slBalance={creditBalance?.slBalance ?? 0}
          year={currentYear}
        />

        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="border-b bg-pcso-navy/5 px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                Credit Breakdown — {currentYear}
              </h2>
            </div>
            <div className="divide-y">
              {[
                {
                  label: "VL Earned this year",
                  value: creditBalance?.vlEarned ?? 0,
                },
                {
                  label: "VL Carry-over from prior year",
                  value: history.vlCarryOver,
                },
                {
                  label: "VL Forfeited (carry-over cap)",
                  value: history.vlForfeited,
                  warn: true,
                },
                {
                  label: "SL Earned this year",
                  value: creditBalance?.slEarned ?? 0,
                },
                {
                  label: "SL Carry-over from prior year",
                  value: history.slCarryOver,
                },
              ].map(({ label, value, warn }) => (
                <div key={label} className="flex justify-between px-5 py-3">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${warn && value > 0 ? "text-amber-600" : "text-foreground"}`}
                  >
                    {value.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                  Years in Service
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-pcso-navy">
                  {yearsInService}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Hire Date</p>
                <p className="mt-1 text-sm font-medium">
                  {hireDate
                    ? hireDate.toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accrual history */}
      <section className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-pcso-navy/5 px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            Monthly Accrual History — {currentYear}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            +1.25 VL and +1.25 SL credited at the end of each completed month.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Month</th>
                <th className="px-4 py-2 text-right">VL Added</th>
                <th className="px-4 py-2 text-right">SL Added</th>
                <th className="px-4 py-2 text-right">VL Running</th>
                <th className="px-4 py-2 text-right">SL Running</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {accrualTimeline.map((row) => {
                const isFuture = row.vlRunning === null;
                return (
                  <tr
                    key={row.month}
                    className={
                      isFuture
                        ? "text-muted-foreground/60"
                        : "hover:bg-muted/30"
                    }
                  >
                    <td className="px-4 py-2">{row.monthLabel}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {isFuture
                        ? "—"
                        : row.vlAdded > 0
                          ? `+${row.vlAdded.toFixed(3)}`
                          : "0.000"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {isFuture
                        ? "—"
                        : row.slAdded > 0
                          ? `+${row.slAdded.toFixed(3)}`
                          : "0.000"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-pcso-navy">
                      {row.vlRunning !== null ? row.vlRunning.toFixed(3) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-700">
                      {row.slRunning !== null ? row.slRunning.toFixed(3) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Usage history */}
      <section className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-pcso-navy/5 px-5 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Recent Leave Usage — {currentYear}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Last 12 approved VL/SL applications.
            </p>
          </div>
          <Link
            href="/leave/applications"
            className="text-xs font-medium text-pcso-navy hover:underline"
          >
            View all →
          </Link>
        </div>
        {usageRecent.length === 0 ? (
          <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
            No approved VL/SL leaves recorded for {currentYear} yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">From</th>
                  <th className="px-4 py-2 text-left">To</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-right">Days</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {usageRecent.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      {new Date(entry.dateFrom).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-2">
                      {new Date(entry.dateTo).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          entry.leaveTypeCode === "VL"
                            ? "font-medium text-pcso-navy"
                            : "font-medium text-emerald-700"
                        }
                      >
                        {entry.leaveTypeName}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {entry.daysDeducted.toFixed(3)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Terminal Leave Estimate */}
      {terminalEstimate && (
        <div className="mt-6 overflow-hidden rounded-xl border border-pcso-gold/30 bg-card shadow-sm">
          <div className="border-b bg-pcso-navy px-5 py-3">
            <h2 className="text-sm font-semibold text-pcso-cream">
              Terminal Leave Estimate (upon retirement/separation)
            </h2>
            <p className="mt-0.5 text-xs text-pcso-cream/60">
              Computed using current balances × estimated daily rate. Not a
              final figure.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            {[
              {
                label: "VL Balance",
                value: `${terminalEstimate.vlBalance.toFixed(3)} days`,
              },
              {
                label: "SL (50%)",
                value: `${terminalEstimate.slEffectiveDays.toFixed(3)} days`,
              },
              {
                label: "Total Effective Days",
                value: `${terminalEstimate.totalEffectiveDays.toFixed(3)} days`,
              },
              {
                label: "Estimated Payout",
                value: formatTerminalLeavePay(
                  terminalEstimate.terminalLeavePay,
                ),
                highlight: true,
              },
            ].map(({ label, value, highlight }) => (
              <div
                key={label}
                className={`rounded-lg p-3 ${highlight ? "bg-pcso-navy/5 border border-pcso-navy/20" : ""}`}
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p
                  className={`mt-1 text-sm font-bold tabular-nums ${highlight ? "text-pcso-navy" : "text-foreground"}`}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>
          <p className="border-t px-5 py-2.5 text-xs text-muted-foreground">
            Formula: (VL + SL × 0.50) × (Monthly Basic Salary / 22 working
            days). Per CSC Omnibus Rules, Rule XVI §56.
          </p>
        </div>
      )}
    </main>
  );
}
