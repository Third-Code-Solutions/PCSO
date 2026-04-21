import * as React from "react";
import Link from "next/link";
import { Palmtree, Clock, ClipboardCheck, CheckCircle2 } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import type { PersonalKpis } from "@/app/(dashboard)/dashboard/queries";

// ─── Component ────────────────────────────────────────────────────────────────

interface PersonalKpiGridProps {
  data: PersonalKpis;
}

/**
 * Role-aware KPI row shown to `employee_self_service` users. Replaces the
 * org-wide KpiGrid with metrics that are relevant to the individual:
 * leave balance, pending applications, approved days YTD, and next payroll
 * cutoff.
 */
export function PersonalKpiGrid({ data }: PersonalKpiGridProps) {
  const cutoffLabel =
    data.payrollCutoffDays === 0 ? "Today" : `${data.payrollCutoffDays}d`;

  return (
    <section aria-label="Your key indicators">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* 1. Leave Balance */}
        <Link
          href="/leave/credits"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Leave Balance"
            value={data.leaveBalanceDays.toFixed(2)}
            detail="VL + SL days available"
            icon={Palmtree}
            iconColorClass="bg-emerald-50 text-emerald-600"
          />
        </Link>

        {/* 2. Pending Applications */}
        <Link
          href="/leave/applications"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Pending Leave"
            value={data.pendingLeaveApplications}
            detail="Awaiting approval"
            icon={ClipboardCheck}
            iconColorClass="bg-amber-50 text-amber-600"
            trend={
              data.pendingLeaveApplications > 0
                ? {
                    direction: "up",
                    label: "Waiting on reviewer",
                    upIsPositive: false,
                  }
                : { direction: "neutral", label: "Nothing pending" }
            }
          />
        </Link>

        {/* 3. Approved YTD */}
        <Link
          href="/leave/applications"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Approved This Year"
            value={data.approvedLeaveApplications}
            detail="Leaves approved year-to-date"
            icon={CheckCircle2}
            iconColorClass="bg-blue-50 text-blue-600"
          />
        </Link>

        {/* 4. Next Payroll */}
        <Link
          href="/payroll/payslips"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Next Payslip"
            value={cutoffLabel}
            detail={data.nextPeriodName ?? "Days until next cutoff"}
            icon={Clock}
            iconColorClass="bg-pcso-navy/10 text-pcso-navy"
          />
        </Link>
      </div>
    </section>
  );
}
