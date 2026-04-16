'use client';

/**
 * TrackingClient — interactive portion of the SALN Compliance Tracking dashboard.
 *
 * Responsibilities:
 *  - KPI cards (Total Employees, Filed, Filed Late, Not Filed, Compliance %)
 *  - Compliance rate progress bar
 *  - Per-office fill rate chart (horizontal bar rows)
 *  - Upcoming April 30 deadline countdown banner
 *  - Non-filer table with per-row "Send Reminder" + bulk controls
 *  - "Send Reminder to All Non-Filers" bulk action
 *  - "Export Non-Compliance Report CSV" — triggers browser download
 *
 * All data is passed as props from the server component; no client-side
 * data fetching occurs here.
 */

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Percent,
  CalendarClock,
  Mail,
  Download,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import type { ComplianceRow } from '@/app/(dashboard)/saln/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OfficeStats {
  officeName: string;
  total: number;
  filed: number;
  fillRate: number;
}

interface TrackingClientProps {
  year: number;
  totalEmployees: number;
  totalFiled: number;
  totalFiledLate: number;
  totalNotFiled: number;
  complianceRate: number;
  officeStats: OfficeStats[];
  daysLeft: number;
  deadlineDateLabel: string;
  nonFilers: ComplianceRow[];
  onSendReminders: (employeeIds: string[]) => Promise<{ sent: number; failed: number }>;
  onExportCsv: () => Promise<{ content: string; filename: string; mimeType: string }>;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  icon: Icon,
  colorClass,
  borderClass,
  textClass,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  colorClass: string;
  borderClass: string;
  textClass: string;
}) {
  return (
    <div className={`rounded-lg border ${borderClass} ${colorClass} p-4`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-medium ${textClass}`}>{label}</p>
        <Icon className={`h-4 w-4 ${textClass} opacity-70`} aria-hidden />
      </div>
      <p className={`mt-2 text-3xl font-bold ${textClass}`}>{value}</p>
    </div>
  );
}

function OfficeBarRow({ stat }: { stat: OfficeStats }) {
  const pct = stat.fillRate;
  const barColor =
    pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-senate-gold' : 'bg-red-400';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate font-medium text-foreground max-w-[200px]" title={stat.officeName}>
          {stat.officeName}
        </span>
        <span className="ml-4 shrink-0 text-xs text-muted-foreground">
          {stat.filed}/{stat.total} — <span className="font-semibold">{pct}%</span>
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${stat.officeName}: ${pct}% filing rate`}
      >
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DeadlineBanner({
  daysLeft,
  deadlineDateLabel,
  year,
}: {
  daysLeft: number;
  deadlineDateLabel: string;
  year: number;
}) {
  const isPast = daysLeft < 0;
  const isUrgent = !isPast && daysLeft <= 7;
  const isWarning = !isPast && daysLeft <= 30 && daysLeft > 7;

  const bannerClass = isPast
    ? 'border-red-300 bg-red-50 text-red-800'
    : isUrgent
      ? 'border-orange-300 bg-orange-50 text-orange-800'
      : isWarning
        ? 'border-senate-gold/40 bg-senate-cream text-senate-navy'
        : 'border-green-200 bg-green-50 text-green-800';

  const IconComponent = isPast || isUrgent ? AlertTriangle : CalendarClock;

  const countdownText = isPast
    ? `Deadline passed ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago`
    : daysLeft === 0
      ? 'Deadline is TODAY'
      : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`;

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${bannerClass}`}>
      <IconComponent className="h-5 w-5 shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">
          Annual SALN Deadline — Calendar Year {year}
        </p>
        <p className="text-xs opacity-80">
          {deadlineDateLabel} &mdash; {countdownText}
        </p>
      </div>
      <span className="shrink-0 rounded-full border border-current px-3 py-0.5 text-xs font-bold tracking-wide">
        {isPast ? 'PAST DUE' : isUrgent ? 'URGENT' : isWarning ? 'SOON' : 'ON TRACK'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TrackingClient({
  year,
  totalEmployees,
  totalFiled,
  totalFiledLate,
  totalNotFiled,
  complianceRate,
  officeStats,
  daysLeft,
  deadlineDateLabel,
  nonFilers,
  onSendReminders,
  onExportCsv,
}: TrackingClientProps) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Filter non-filer table
  const filteredNonFilers = nonFilers.filter((row) => {
    if (search === '') return true;
    const q = search.toLowerCase();
    return (
      row.employeeName.toLowerCase().includes(q) ||
      row.employeeNo.toLowerCase().includes(q) ||
      (row.officeName ?? '').toLowerCase().includes(q) ||
      row.positionTitle.toLowerCase().includes(q)
    );
  });

  // Send reminder to one employee
  function handleSendSingle(employeeId: string, employeeName: string) {
    setSendingId(employeeId);
    startTransition(async () => {
      try {
        const result = await onSendReminders([employeeId]);
        if (result.sent > 0) {
          toast.success(`Reminder sent to ${employeeName}`);
        } else {
          toast.error(`Failed to send reminder to ${employeeName}`, {
            description: 'Check that the employee has an email address on file.',
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send reminder.';
        toast.error('Send failed', { description: message });
      } finally {
        setSendingId(null);
      }
    });
  }

  // Bulk: send to all non-filers (no filter applied — always all)
  function handleSendAll() {
    startTransition(async () => {
      try {
        const result = await onSendReminders([]);
        toast.success(`Reminders sent to ${result.sent} employee(s)`, {
          description:
            result.failed > 0
              ? `${result.failed} reminder(s) failed — check email addresses.`
              : undefined,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send reminders.';
        toast.error('Bulk send failed', { description: message });
      }
    });
  }

  // Export non-compliance report as CSV download
  function handleExport() {
    startTransition(async () => {
      try {
        const result = await onExportCsv();
        const blob = new Blob([result.content], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = result.filename;
        anchor.click();
        URL.revokeObjectURL(url);
        toast.success('Export downloaded', {
          description: `${result.filename} saved to your downloads folder.`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Export failed.';
        toast.error('Export failed', { description: message });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Deadline countdown banner */}
      <DeadlineBanner daysLeft={daysLeft} deadlineDateLabel={deadlineDateLabel} year={year} />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Total Employees"
          value={totalEmployees}
          icon={Users}
          colorClass="bg-card"
          borderClass="border-border"
          textClass="text-senate-navy"
        />
        <KpiCard
          label="Filed"
          value={totalFiled}
          icon={CheckCircle2}
          colorClass="bg-green-50"
          borderClass="border-green-200"
          textClass="text-green-800"
        />
        <KpiCard
          label="Not Filed"
          value={totalNotFiled}
          icon={XCircle}
          colorClass="bg-red-50"
          borderClass="border-red-200"
          textClass="text-red-800"
        />
        <KpiCard
          label="Filed Late"
          value={totalFiledLate}
          icon={Clock}
          colorClass="bg-orange-50"
          borderClass="border-orange-200"
          textClass="text-orange-800"
        />
        <KpiCard
          label="Compliance %"
          value={`${complianceRate}%`}
          icon={Percent}
          colorClass="bg-senate-navy"
          borderClass="border-senate-navy"
          textClass="text-white"
        />
      </div>

      {/* Compliance rate progress bar */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">
            Overall Compliance Rate — CY {year}
          </span>
          <span className="text-sm font-bold text-senate-navy">{complianceRate}%</span>
        </div>
        <div
          className="h-3 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={complianceRate}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Overall compliance rate: ${complianceRate}%`}
        >
          <div
            className={`h-full rounded-full transition-all ${
              complianceRate >= 80
                ? 'bg-green-500'
                : complianceRate >= 50
                  ? 'bg-senate-gold'
                  : 'bg-red-400'
            }`}
            style={{ width: `${complianceRate}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {totalFiled + totalFiledLate} of {totalEmployees} employees have filed (including {totalFiledLate} late).
        </p>
      </div>

      {/* Per-office fill rate bars */}
      {officeStats.length > 0 && (
        <section aria-labelledby="office-heading">
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-senate-navy" aria-hidden />
              <h2 id="office-heading" className="text-sm font-semibold text-foreground">
                Filing Rate by Office
              </h2>
            </div>
            <div className="space-y-3">
              {officeStats.map((stat) => (
                <OfficeBarRow key={stat.officeName} stat={stat} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Non-filer table */}
      <section aria-labelledby="nonfiler-heading">
        <div className="rounded-lg border border-border bg-card">
          {/* Table header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 id="nonfiler-heading" className="text-sm font-semibold text-foreground">
                Non-Filers
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalNotFiled} employee{totalNotFiled !== 1 ? 's' : ''} have not filed for CY {year}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search non-filers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-52 text-sm"
                aria-label="Search non-filers"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending || totalNotFiled === 0}
                onClick={handleSendAll}
              >
                <Mail className="mr-1.5 h-4 w-4" aria-hidden />
                Send Reminder to All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={handleExport}
              >
                <Download className="mr-1.5 h-4 w-4" aria-hidden />
                Export Non-Compliance CSV
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead>Filing Status</TableHead>
                  <TableHead className="w-32 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNonFilers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      {totalNotFiled === 0
                        ? 'All employees have filed their SALN.'
                        : 'No results match your search.'}
                    </TableCell>
                  </TableRow>
                )}
                {filteredNonFilers.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell className="font-mono text-sm">{row.employeeNo}</TableCell>
                    <TableCell className="font-medium">{row.employeeName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.positionTitle}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.officeName ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="gap-1 text-xs">
                        <XCircle className="h-3 w-3" aria-hidden />
                        Not Filed
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-senate-navy hover:bg-senate-navy/10"
                        disabled={isPending && sendingId === row.employeeId}
                        onClick={() => handleSendSingle(row.employeeId, row.employeeName)}
                        aria-label={`Send reminder to ${row.employeeName}`}
                      >
                        <Mail className="mr-1 h-3 w-3" aria-hidden />
                        {isPending && sendingId === row.employeeId
                          ? 'Sending...'
                          : 'Send Reminder'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredNonFilers.length > 0 && (
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              Showing {filteredNonFilers.length} of {totalNotFiled} non-filer
              {totalNotFiled !== 1 ? 's' : ''}.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
