/**
 * /performance/step-increments/[employeeId] — Process / view step increment
 *
 * Shows the employee's rating history, eligibility status, and allows
 * HR admin to process a step increment.
 */

import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { RatingBadge } from "@/components/performance/rating-badge";
import { StepIncrementTable } from "@/components/performance/step-increment-table";
import {
  getStepIncrementsByEmployee,
  getApprovedIpcrfWithPeriodDates,
} from "../../queries";
import {
  approveStepIncrement,
  implementStepIncrement,
  cancelStepIncrement,
} from "../../actions";
import {
  checkStepEligibility,
  toRatingRecord,
} from "@/lib/utils/performance/step-eligibility";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AdjectivalRating } from "@/lib/constants/performance";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ employeeId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { employeeId } = await params;
  void employeeId;
  return { title: "Step Increment — Employee" };
}

// ─── Step-increment form actions (bound to StepIncrementTable) ───────────────
// Each delegates to the guarded server action in ../../actions, which enforces
// the required permission (approve / process / edit) and the state machine.

async function approveStepIncrementAction(formData: FormData): Promise<void> {
  "use server";
  await approveStepIncrement({
    stepIncrementId: String(formData.get("stepIncrementId") ?? ""),
  });
}

async function implementStepIncrementAction(formData: FormData): Promise<void> {
  "use server";
  await implementStepIncrement({
    stepIncrementId: String(formData.get("stepIncrementId") ?? ""),
  });
}

async function cancelStepIncrementAction(formData: FormData): Promise<void> {
  "use server";
  await cancelStepIncrement({
    stepIncrementId: String(formData.get("stepIncrementId") ?? ""),
    reason: String(formData.get("reason") ?? "Cancelled by HR"),
  });
}

export default async function EmployeeStepIncrementPage({ params }: Props) {
  const { employeeId } = await params;
  const user = await requirePermission("performance", "view");
  const canApprove = hasPermission(user.role, "performance", "approve");
  const canProcess = hasPermission(user.role, "performance", "process");
  const canCancel = hasPermission(user.role, "performance", "edit");

  const supabase = supabaseAdmin;

  // Fetch employee details
  const { data: emp, error: empError } = await supabase
    .from("employees")
    .select(
      "id, first_name, last_name, employee_no, position_title, salary_grade, step, office_id, offices(name)",
    )
    .eq("id", employeeId)
    .is("deleted_at", null)
    .single();

  if (empError || !emp) notFound();

  const officeData = emp.offices as { name?: string } | null;
  const fullName = `${emp.last_name}, ${emp.first_name}`;

  const [incrementHistory, ipcrf] = await Promise.all([
    getStepIncrementsByEmployee(employeeId),
    getApprovedIpcrfWithPeriodDates(employeeId),
  ]);

  // Build rating records for eligibility check using actual period dateFrom
  const ratingRecords = ipcrf.map((r) =>
    toRatingRecord({
      periodLabel: r.periodLabel,
      numericalRating: r.numericalRating,
      periodDateFrom: r.periodDateFrom,
    }),
  );

  // Find last increment date
  const lastIncrement = incrementHistory.find(
    (i) => i.status === "implemented" || i.status === "approved",
  );
  const lastIncrementDate = lastIncrement?.effectivityDate ?? null;

  // PRD §10.5: pass current step so Step-8 employees are flagged ineligible.
  const eligibility = checkStepEligibility(
    ratingRecords,
    lastIncrementDate,
    Number(emp.step),
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader
        title={`Step Increment — ${fullName}`}
        description={`${emp.position_title} · SG ${emp.salary_grade} · Step ${emp.step}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Performance", href: "/performance" },
          { label: "Step Increments", href: "/performance/step-increments" },
          { label: fullName },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Eligibility + Employee Info */}
        <aside className="space-y-4">
          {/* Eligibility card */}
          <div
            className={`rounded-xl border-2 p-4 shadow-sm ${
              eligibility.eligible
                ? "border-emerald-300 bg-emerald-50"
                : "border-border bg-card"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Eligibility Status
            </p>
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`text-2xl font-bold ${
                  eligibility.eligible
                    ? "text-emerald-700"
                    : "text-muted-foreground"
                }`}
              >
                {eligibility.eligible ? "Eligible" : "Not Eligible"}
              </span>
            </div>

            {eligibility.eligible ? (
              <>
                <Badge variant="success" className="mb-3">
                  {eligibility.triggerRule === "two_consecutive_outstanding"
                    ? "2 Consecutive Outstanding"
                    : "3 Consecutive Satisfactory or Better"}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Based on {eligibility.consecutiveCount} consecutive qualifying
                  periods.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {eligibility.ineligibilityReason}
              </p>
            )}
          </div>

          {/* Employee details */}
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Employee
            </p>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">
                  Employee No.
                </span>
                <p className="font-medium">{emp.employee_no}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Office</span>
                <p className="font-medium">{officeData?.name ?? "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">
                  Current Step
                </span>
                <p className="text-xl font-bold text-pcso-navy">
                  Step {emp.step}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Right: History + Ratings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Rating history */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Approved IPCRF Ratings ({ipcrf.length})
            </h2>

            {ipcrf.length === 0 ? (
              <div className="flex h-24 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                No approved IPCRF ratings on record.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      {["Period", "Rating", "Qualifies?"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ipcrf.map((r) => {
                      const numerical = parseFloat(r.numericalRating);
                      const qualifies = numerical >= 2.5; // Satisfactory+ (§10.5)
                      const isInQualifyingPeriods =
                        eligibility.qualifyingPeriods.some(
                          (qp) => qp.periodLabel === r.periodLabel,
                        );
                      return (
                        <tr
                          key={r.id}
                          className={
                            isInQualifyingPeriods ? "bg-emerald-50/50" : ""
                          }
                        >
                          <td className="px-4 py-2.5 font-medium">
                            {r.periodLabel}
                          </td>
                          <td className="px-4 py-2.5">
                            <RatingBadge
                              adjectival={
                                r.adjectivalRating as AdjectivalRating
                              }
                              numerical={numerical}
                              size="sm"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            {qualifies ? (
                              <span className="text-emerald-700 text-xs font-medium">
                                Yes
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                No
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Step increment records */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Step Increment History
            </h2>
            <StepIncrementTable
              increments={incrementHistory}
              showEmployee={false}
              approveAction={
                canApprove ? approveStepIncrementAction : undefined
              }
              implementAction={
                canProcess ? implementStepIncrementAction : undefined
              }
              cancelAction={canCancel ? cancelStepIncrementAction : undefined}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
