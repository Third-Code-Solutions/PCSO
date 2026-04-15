import Link from 'next/link';
import { Clock, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layouts/page-header';
import { PeriodStatusBadge } from '@/components/payroll/period-status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/guards';
import { getPayrollPeriods } from '../queries';

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

export const metadata = { title: 'Payroll History' };

export default async function PayrollHistoryPage() {
  await requirePermission('payroll', 'view');

  const periods = await getPayrollPeriods({ limit: 100 });

  // Group by year
  const byYear = periods.reduce<Record<number, typeof periods>>((acc, period) => {
    const year = new Date(period.periodStart).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(period);
    return acc;
  }, {});

  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <main className="space-y-8">
      <PageHeader
        title="Payroll History"
        description="Complete history of all payroll periods."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Payroll', href: '/payroll' },
          { label: 'History' },
        ]}
      />

      {periods.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Clock className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold">No payroll history yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Completed payroll periods will appear here.
          </p>
        </div>
      ) : (
        years.map((year) => (
          <section key={year} aria-labelledby={`year-${year}-heading`}>
            <h2
              id={`year-${year}-heading`}
              className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {year}
            </h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead className="text-right">Employees</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byYear[year].map((period) => (
                    <TableRow key={period.id} className="group">
                      <TableCell>
                        <Link
                          href={`/payroll/${period.id}`}
                          className="font-medium text-[#0B2545] group-hover:underline"
                        >
                          {period.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(period.periodStart)} – {formatDate(period.periodEnd)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">
                          {period.scope === 'jo_cos' ? 'JO/COS' : 'Regular'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {period.employeeCount ?? '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {formatPeso(period.totalNetPay)}
                      </TableCell>
                      <TableCell>
                        <PeriodStatusBadge status={period.status} />
                      </TableCell>
                      <TableCell>
                        <Link href={`/payroll/${period.id}`}>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ))
      )}
    </main>
  );
}
