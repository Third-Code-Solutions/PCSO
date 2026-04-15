import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/layouts/page-header';
import { PeriodStatusBadge } from '@/components/payroll/period-status-badge';
import { RecordBreakdown } from '@/components/payroll/record-breakdown';
import { requirePermission } from '@/lib/auth/guards';
import { getPayrollRecordById, getAdjustmentsByRecord } from '../../../../queries';
import type { PayrollPeriodStatus } from '@/lib/db/schema';
import { RecordOverrideButton } from './_components/record-override-button';

interface Props {
  params: Promise<{ periodId: string; recordId: string }>;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPeso(value: string | null | undefined): string {
  if (!value) return '₱0.00';
  const num = parseFloat(value);
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const RECORD_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  override: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paid: 'bg-[#C8A84B] text-white border-[#C8A84B]',
};

export default async function RecordDetailPage({ params }: Props) {
  const { periodId, recordId } = await params;
  await requirePermission('payroll', 'view');

  const [record, adjustments] = await Promise.all([
    getPayrollRecordById(recordId),
    getAdjustmentsByRecord(recordId),
  ]);

  if (!record) notFound();

  const fullName = [record.employee.lastName, record.employee.firstName, record.employee.middleName]
    .filter(Boolean)
    .join(', ');

  const canOverride = record.status !== 'paid';

  return (
    <main className="space-y-6">
      <PageHeader
        title={fullName}
        description={`${record.positionTitle} · SG ${record.salaryGrade}-${record.step}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Payroll', href: '/payroll' },
          { label: 'Period', href: `/payroll/${periodId}` },
          { label: 'Record Detail' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={RECORD_STATUS_COLORS[record.status] ?? ''}
            >
              {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
            </Badge>
            {record.hasException && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Exception
              </Badge>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/payroll/${periodId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            {canOverride && (
              <RecordOverrideButton recordId={recordId} periodId={periodId} />
            )}
          </div>
        }
      />

      {/* Employee Info */}
      <Card className="border-[#0B2545]/10 bg-[#FAF4E6]">
        <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Employee No.</p>
            <p className="mt-0.5 font-mono text-sm font-semibold">{record.employee.employeeNo}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Appointment Type</p>
            <p className="mt-0.5 text-sm font-semibold capitalize">
              {record.appointmentType.replace(/_/g, ' ')}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Office</p>
            <p className="mt-0.5 text-sm font-semibold">
              {record.employee.officeName ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Late / Undertime / Absent</p>
            <p className="mt-0.5 font-mono text-sm">
              {record.lateMinutes}min / {record.undertimeMinutes}min / {record.absenceDays}d
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Exception Notice */}
      {record.hasException && record.exceptionNotes && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Exception Detected</p>
            <p className="mt-1 text-sm text-amber-700">{record.exceptionNotes}</p>
          </div>
        </div>
      )}

      {/* Computation Breakdown */}
      <section aria-labelledby="breakdown-heading">
        <h2
          id="breakdown-heading"
          className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#0B2545]"
        >
          Pay Computation
        </h2>
        <RecordBreakdown record={record} />
      </section>

      {/* Adjustment History */}
      {adjustments.length > 0 && (
        <section aria-labelledby="adjustments-heading">
          <Separator className="my-2" />
          <h2
            id="adjustments-heading"
            className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#0B2545]"
          >
            Override History ({adjustments.length})
          </h2>
          <div className="space-y-3">
            {adjustments.map((adj) => (
              <div
                key={adj.id}
                className="rounded-lg border border-amber-200 bg-amber-50/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {adj.fieldName.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {adj.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground line-through">
                      {formatPeso(adj.originalValue ?? undefined)}
                    </p>
                    <p className="font-mono text-sm font-semibold text-[#0B2545]">
                      {formatPeso(adj.adjustedValue)}
                    </p>
                  </div>
                </div>
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground">{adj.justification}</p>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {adj.createdAt ? formatDateTime(adj.createdAt.toISOString()) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
