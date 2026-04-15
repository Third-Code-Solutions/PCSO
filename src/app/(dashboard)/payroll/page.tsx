import Link from 'next/link';
import { Plus, FileText, Users, Clock } from 'lucide-react';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PeriodStatusBadge } from '@/components/payroll/period-status-badge';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import { requirePermission } from '@/lib/auth/guards';
import { getPayrollPeriods } from './queries';
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

function PeriodCard({ period }: { period: PayrollPeriod }) {
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
            <p className="text-xs text-muted-foreground">Employees</p>
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

        {period.scope === 'jo_cos' && (
          <p className="mt-2 text-right text-xs text-muted-foreground">JO/COS Run</p>
        )}
      </article>
    </Link>
  );
}

export default async function PayrollPage() {
  await requirePermission('payroll', 'view');

  const [allPeriods, draftPeriods] = await Promise.all([
    getPayrollPeriods({ limit: 20 }),
    getPayrollPeriods({ status: 'draft', limit: 5 }),
  ]);

  const activePeriods = allPeriods.filter(
    (p) => p.status === 'processing' || p.status === 'approved',
  );
  const paidPeriods = allPeriods.filter((p) => p.status === 'paid');

  return (
    <main className="space-y-8">
      <RealtimeBoundary tables={['payroll_periods', 'payroll_records']} />
      <PageHeader
        title="Payroll"
        description="Manage payroll periods, process computations, and distribute payslips."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Payroll' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/payroll/history">
                <Clock className="mr-2 h-4 w-4" />
                History
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/payroll/jo-cos">
                <Users className="mr-2 h-4 w-4" />
                JO/COS Runs
              </Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="bg-[#0B2545] text-white hover:bg-[#13315C]"
            >
              <Link href="/payroll/new">
                <Plus className="mr-2 h-4 w-4" />
                New Period
              </Link>
            </Button>
          </div>
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: 'Active Periods',
            value: activePeriods.length,
            icon: FileText,
            color: 'text-[#0B2545]',
          },
          {
            label: 'Draft',
            value: draftPeriods.length,
            icon: FileText,
            color: 'text-muted-foreground',
          },
          {
            label: 'Paid This Year',
            value: paidPeriods.length,
            icon: FileText,
            color: 'text-emerald-600',
          },
          {
            label: 'Total Periods',
            value: allPeriods.length,
            icon: FileText,
            color: 'text-[#C8A84B]',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <Icon className={`h-8 w-8 shrink-0 ${color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active / In-Progress */}
      {activePeriods.length > 0 && (
        <section aria-labelledby="active-heading">
          <h2 id="active-heading" className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#0B2545]">
            In Progress
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activePeriods.map((period) => (
              <PeriodCard key={period.id} period={period} />
            ))}
          </div>
        </section>
      )}

      {/* Draft Periods */}
      {draftPeriods.length > 0 && (
        <section aria-labelledby="draft-heading">
          <h2 id="draft-heading" className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Drafts
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {draftPeriods.map((period) => (
              <PeriodCard key={period.id} period={period} />
            ))}
          </div>
        </section>
      )}

      {/* All Periods */}
      {allPeriods.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-20 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold text-foreground">No payroll periods yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first payroll period to get started.
          </p>
          <Button
            size="sm"
            asChild
            className="mt-6 bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            <Link href="/payroll/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Period
            </Link>
          </Button>
        </div>
      )}
    </main>
  );
}
