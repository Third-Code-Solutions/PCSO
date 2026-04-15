import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PeriodStatusBadge } from '@/components/payroll/period-status-badge';
import { requirePermission } from '@/lib/auth/guards';
import { getPayrollPeriods } from '../queries';
import type { PayrollPeriod } from '@/lib/db/schema';

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPeso(value: string | null | undefined): string {
  if (!value) return '—';
  const num = parseFloat(value);
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function JoCosCard({ period }: { period: PayrollPeriod }) {
  return (
    <Link href={`/payroll/${period.id}`} className="group block">
      <article className="rounded-xl border border-border bg-card p-5 transition-all hover:border-[#C8A84B] hover:shadow-md">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-[#0B2545] group-hover:underline">
              {period.name}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDate(period.periodStart)} – {formatDate(period.periodEnd)}
            </p>
          </div>
          <PeriodStatusBadge status={period.status} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/40 p-2">
            <p className="text-xs text-muted-foreground">Net Pay</p>
            <p className="mt-0.5 text-sm font-semibold text-[#0B2545]">
              {formatPeso(period.totalNetPay)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <p className="text-xs text-muted-foreground">Contractors</p>
            <p className="mt-0.5 text-sm font-semibold text-[#0B2545]">
              {period.employeeCount ?? '—'}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <p className="text-xs text-muted-foreground">Pay Date</p>
            <p className="mt-0.5 text-sm font-semibold text-[#0B2545]">
              {formatDate(period.payDate)}
            </p>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default async function JoCosPayrollPage() {
  await requirePermission('payroll', 'view');

  const periods = await getPayrollPeriods({ scope: 'jo_cos', limit: 50 });

  return (
    <main className="space-y-6">
      <PageHeader
        title="JO / COS Payroll Runs"
        description="Payroll periods for Job Order and Contract of Service employees. These are processed separately — no mandatory government deductions apply."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Payroll', href: '/payroll' },
          { label: 'JO/COS Runs' },
        ]}
        actions={
          <Button size="sm" asChild className="bg-[#0B2545] text-white hover:bg-[#13315C]">
            <Link href="/payroll/new">
              <Plus className="mr-2 h-4 w-4" />
              New JO/COS Period
            </Link>
          </Button>
        }
      />

      {periods.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-20 text-center">
          <Users className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold">No JO/COS payroll runs yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a new period with scope set to "JO/COS" to get started.
          </p>
          <Button size="sm" asChild className="mt-6 bg-[#0B2545] text-white hover:bg-[#13315C]">
            <Link href="/payroll/new">
              <Plus className="mr-2 h-4 w-4" />
              Create JO/COS Period
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Key difference callout */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm text-blue-800">
              <strong>JO/COS rules:</strong> Basic pay only. No GSIS, PhilHealth, Pag-IBIG,
              RATA, longevity pay, or PERA. Withholding tax applies to amounts above the
              TRAIN Law exemption threshold.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {periods.map((period) => (
              <JoCosCard key={period.id} period={period} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
