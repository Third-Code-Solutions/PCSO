import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Play, FileBarChart, AlertTriangle, DollarSign } from 'lucide-react';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PeriodStatusBadge } from '@/components/payroll/period-status-badge';
import { RecordsTable } from '@/components/payroll/records-table';
import { ExceptionReport } from '@/components/payroll/exception-report';
import { requirePermission } from '@/lib/auth/guards';
import {
  getPayrollPeriodById,
  getPayrollRecordsByPeriod,
  getExceptionRecords,
  getPeriodTotals,
} from '../queries';
import { PeriodActionsBar } from './_components/period-actions-bar';

interface Props {
  params: Promise<{ periodId: string }>;
}

function formatPeso(value: string | null | undefined): string {
  if (!value) return '₱0.00';
  const num = parseFloat(value);
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function PayrollPeriodPage({ params }: Props) {
  const { periodId } = await params;
  await requirePermission('payroll', 'view');

  const [period, records, exceptions, totals] = await Promise.all([
    getPayrollPeriodById(periodId),
    getPayrollRecordsByPeriod(periodId),
    getExceptionRecords(periodId),
    getPeriodTotals(periodId),
  ]);

  if (!period) notFound();

  return (
    <main className="space-y-6">
      <PageHeader
        title={period.name}
        description={`${formatDate(period.periodStart)} – ${formatDate(period.periodEnd)} · Pay Date: ${formatDate(period.payDate)}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Payroll', href: '/payroll' },
          { label: period.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <PeriodStatusBadge status={period.status} />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/payroll/${periodId}/register`}>
                <FileBarChart className="mr-2 h-4 w-4" />
                Register
              </Link>
            </Button>
          </div>
        }
      />

      {/* Workflow Actions */}
      <PeriodActionsBar period={period} />

      {/* Summary Totals */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              label: 'Employees',
              value: totals.employeeCount.toString(),
              icon: DollarSign,
            },
            {
              label: 'Gross Pay',
              value: formatPeso(totals.totalGrossPay),
              icon: DollarSign,
            },
            {
              label: 'Deductions',
              value: formatPeso(totals.totalDeductions),
              icon: DollarSign,
              negative: true,
            },
            {
              label: 'Net Pay',
              value: formatPeso(totals.totalNetPay),
              icon: DollarSign,
              highlight: true,
            },
          ].map(({ label, value, icon: Icon, negative, highlight }) => (
            <Card
              key={label}
              className={highlight ? 'border-[#C8A84B] bg-[#FAF4E6]' : ''}
            >
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p
                  className={`mt-1 text-lg font-bold ${
                    highlight
                      ? 'text-[#0B2545]'
                      : negative
                        ? 'text-red-600'
                        : 'text-foreground'
                  }`}
                >
                  {value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Exceptions Banner */}
      {exceptions.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex flex-1 items-center justify-between">
            <p className="text-sm text-amber-800">
              <strong>{exceptions.length} record{exceptions.length !== 1 ? 's' : ''}</strong>{' '}
              have exceptions and need review before approval.
            </p>
            <Link
              href="#exceptions"
              className="ml-4 text-sm font-medium text-amber-700 hover:underline"
            >
              View exceptions
            </Link>
          </div>
        </div>
      )}

      {/* Tabs: Records / Exceptions */}
      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">
            Records ({records.length})
          </TabsTrigger>
          <TabsTrigger value="exceptions">
            Exceptions
            {exceptions.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 text-xs text-white px-1">
                {exceptions.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-4">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <Play className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">No records yet</p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                {period.status === 'draft'
                  ? 'Lock this period, then run "Process Payroll" to generate records.'
                  : 'Process the payroll to generate employee records.'}
              </p>
            </div>
          ) : (
            <RecordsTable records={records} periodId={periodId} />
          )}
        </TabsContent>

        <TabsContent value="exceptions" className="mt-4" id="exceptions">
          <ExceptionReport records={exceptions} periodId={periodId} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
