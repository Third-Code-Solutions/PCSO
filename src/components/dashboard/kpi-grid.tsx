import * as React from 'react';
import { Users, Building, Clock, CalendarCheck, Landmark } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';

// TODO: Wire to real data from server actions / TanStack Query when dashboard API is ready
// All values below are placeholder zeros — the module agents will replace these with live queries.

interface KpiData {
  totalEmployees: number;
  permanentCount: number;
  joCosCount: number;
  vacantPositions: number;
  pendingLeaveApplications: number;
  payrollCutoffDays: number;
  remittancesDueThisMonth: string; // stored as string per CONVENTIONS.md
}

const PLACEHOLDER_DATA: KpiData = {
  totalEmployees: 0,
  permanentCount: 0,
  joCosCount: 0,
  vacantPositions: 0,
  pendingLeaveApplications: 0,
  payrollCutoffDays: 0,
  remittancesDueThisMonth: '0.00',
};

interface KpiGridProps {
  // TODO: Accept real data props when wired to API
  data?: Partial<KpiData>;
}

export function KpiGrid({ data = {} }: KpiGridProps) {
  const kpi: KpiData = { ...PLACEHOLDER_DATA, ...data };

  const formatPeso = (amount: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '₱0.00';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(num);
  };

  return (
    <section aria-label="Key performance indicators">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {/* Total Employees */}
        <KpiCard
          title="Total Employees"
          value={kpi.totalEmployees}
          detail={`Permanent: ${kpi.permanentCount.toLocaleString('en-PH')} · JO/COS: ${kpi.joCosCount.toLocaleString('en-PH')}`}
          icon={Users}
          iconColorClass="bg-blue-50 text-blue-600"
        />

        {/* Vacant Plantilla Positions */}
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

        {/* Pending Leave Applications */}
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

        {/* Payroll Cutoff */}
        <KpiCard
          title="Payroll Cutoff"
          value={
            kpi.payrollCutoffDays === 0
              ? 'Today'
              : `${kpi.payrollCutoffDays}d`
          }
          detail="Days until next cutoff"
          icon={Clock}
          iconColorClass="bg-emerald-50 text-emerald-600"
          trend={
            kpi.payrollCutoffDays <= 3
              ? { direction: 'down', label: 'Cutoff soon', upIsPositive: true }
              : { direction: 'neutral', label: 'On schedule' }
          }
        />

        {/* Remittances Due */}
        <KpiCard
          title="Remittances Due"
          value={formatPeso(kpi.remittancesDueThisMonth)}
          detail="Total for this month (GSIS, PhilHealth, Pag-IBIG, BIR)"
          icon={Landmark}
          iconColorClass="bg-rose-50 text-rose-600"
        />
      </div>
    </section>
  );
}
