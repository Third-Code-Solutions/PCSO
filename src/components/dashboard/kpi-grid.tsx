import * as React from 'react';
import Link from 'next/link';
import { Users, Building, CalendarCheck, Clock, Landmark } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { formatPeso } from '@/lib/utils/format';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiData {
  totalEmployees: number;
  permanentCount: number;
  joCosCount: number;
  vacantPositions: number;
  pendingLeaveApplications: number;
  /** Days until next payroll period end cutoff; 0 means today or overdue */
  payrollCutoffDays: number;
  /** Total pending remittances this month as a numeric string */
  remittancesDueThisMonth: string;
}

const DEFAULTS: KpiData = {
  totalEmployees: 0,
  permanentCount: 0,
  joCosCount: 0,
  vacantPositions: 0,
  pendingLeaveApplications: 0,
  payrollCutoffDays: 0,
  remittancesDueThisMonth: '0.00',
};

interface KpiGridProps {
  data?: Partial<KpiData>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function KpiGrid({ data = {} }: KpiGridProps) {
  const kpi: KpiData = { ...DEFAULTS, ...data };

  const cutoffLabel =
    kpi.payrollCutoffDays === 0 ? 'Today' : `${kpi.payrollCutoffDays}d`;

  return (
    <section aria-label="Key performance indicators">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {/* 1. Active Employees */}
        <Link href="/employees" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
          <KpiCard
            title="Active Employees"
            value={kpi.totalEmployees}
            detail={`Permanent: ${kpi.permanentCount.toLocaleString('en-PH')} · JO/COS: ${kpi.joCosCount.toLocaleString('en-PH')}`}
            icon={Users}
            iconColorClass="bg-blue-50 text-blue-600"
          />
        </Link>

        {/* 2. Vacant Plantilla Positions */}
        <Link href="/plantilla/vacancies" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
          <KpiCard
            title="Vacant Positions"
            value={kpi.vacantPositions}
            detail="Unfilled plantilla items"
            icon={Building}
            iconColorClass="bg-amber-50 text-amber-600"
            trend={
              kpi.vacantPositions > 0
                ? {
                    direction: 'up',
                    label: `${kpi.vacantPositions} position${kpi.vacantPositions !== 1 ? 's' : ''} to fill`,
                    upIsPositive: false,
                  }
                : { direction: 'neutral', label: 'All positions filled' }
            }
          />
        </Link>

        {/* 3. Pending Leave Applications */}
        <Link href="/leave/approvals" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
          <KpiCard
            title="Pending Leave"
            value={kpi.pendingLeaveApplications}
            detail="Applications awaiting approval"
            icon={CalendarCheck}
            iconColorClass="bg-purple-50 text-purple-600"
            trend={
              kpi.pendingLeaveApplications > 0
                ? {
                    direction: 'up',
                    label: `${kpi.pendingLeaveApplications} for review`,
                    upIsPositive: false,
                  }
                : { direction: 'neutral', label: 'No pending applications' }
            }
          />
        </Link>

        {/* 4. Next Payroll Cutoff */}
        <Link href="/payroll" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
          <KpiCard
            title="Payroll Cutoff"
            value={cutoffLabel}
            detail="Days until next cutoff"
            icon={Clock}
            iconColorClass="bg-emerald-50 text-emerald-600"
            trend={
              kpi.payrollCutoffDays <= 3
                ? { direction: 'down', label: 'Cutoff soon', upIsPositive: true }
                : { direction: 'neutral', label: 'On schedule' }
            }
          />
        </Link>

        {/* 5. Remittances Due This Month */}
        <KpiCard
          title="Remittances Due"
          value={formatPeso(kpi.remittancesDueThisMonth)}
          detail="Pending this month (GSIS, PhilHealth, Pag-IBIG, BIR)"
          icon={Landmark}
          iconColorClass="bg-rose-50 text-rose-600"
        />
      </div>
    </section>
  );
}
