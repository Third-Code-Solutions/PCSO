'use client';

/**
 * Leave Applications browser — client components
 *
 * Contains:
 *  - TabSwitcher          : URL-driven tab navigation
 *  - MyApplicationsTable  : own applications with cancel action
 *  - PendingApprovalTable : approval queue with inline approve/disapprove
 *  - AllApplicationsTable : full filterable history + CSV export
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { LEAVE_TYPES } from '@/lib/constants/leave-types';
import type { LeaveTypeCode } from '@/lib/constants/leave-types';
import { toast } from 'sonner';
import {
  CheckIcon,
  XIcon,
  DownloadIcon,
  FilterIcon,
} from 'lucide-react';
import {
  cancelLeaveApplication,
  bulkApprove,
  exportCsv,
} from './actions';
import type {
  LeaveApplicationRow,
  LeaveApplicationRowEnriched,
} from '@/app/(dashboard)/leave/queries';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<
  string,
  'success' | 'destructive' | 'warning' | 'muted' | 'info'
> = {
  approved: 'success',
  disapproved: 'destructive',
  cancelled: 'muted',
  pending: 'warning',
  recalled: 'muted',
};

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// TabSwitcher
// ---------------------------------------------------------------------------

export type TabKey = 'mine' | 'pending' | 'all';

interface TabSwitcherProps {
  activeTab: TabKey;
  showPending: boolean;
  showAll: boolean;
}

export function TabSwitcher({ activeTab, showPending, showAll }: TabSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();

  function navigate(tab: TabKey) {
    const params = new URLSearchParams();
    params.set('tab', tab);
    router.push(`${pathname}?${params.toString()}`);
  }

  const tabs: { key: TabKey; label: string; show: boolean }[] = [
    { key: 'mine', label: 'My Applications', show: true },
    { key: 'pending', label: 'Pending Approval', show: showPending },
    { key: 'all', label: 'All', show: showAll },
  ];

  return (
    <nav
      aria-label="Leave application views"
      className="flex gap-1 rounded-lg border bg-muted/30 p-1"
    >
      {tabs
        .filter((t) => t.show)
        .map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => navigate(t.key)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              activeTab === t.key
                ? 'bg-white text-senate-navy shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-current={activeTab === t.key ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Shared table shell
// ---------------------------------------------------------------------------

function TableShell({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children: React.ReactNode;
  empty?: boolean;
}) {
  if (empty) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
        <p className="text-sm font-medium text-muted-foreground">No applications found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MyApplicationsTable
// ---------------------------------------------------------------------------

interface MyApplicationsTableProps {
  applications: LeaveApplicationRow[];
}

export function MyApplicationsTable({ applications }: MyApplicationsTableProps) {
  const [isPending, startTransition] = useTransition();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  function handleCancel(id: string) {
    setCancellingId(id);
    startTransition(async () => {
      try {
        await cancelLeaveApplication({ leaveApplicationId: id });
        toast.success('Leave application cancelled.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to cancel.');
      } finally {
        setCancellingId(null);
      }
    });
  }

  const headers = [
    'Leave Type',
    'Date From',
    'Date To',
    'Days',
    'Reason',
    'Status',
    'Filed On',
    '',
  ];

  return (
    <TableShell headers={headers} empty={applications.length === 0}>
      {applications.map((app) => (
        <tr
          key={app.id}
          className={cn(
            'group hover:bg-muted/20 transition-colors',
            cancellingId === app.id && 'opacity-50 pointer-events-none',
          )}
        >
          <td className="px-4 py-3">
            <span className="font-medium">
              {LEAVE_TYPES[app.leaveTypeCode as LeaveTypeCode]?.name ?? app.leaveTypeName}
            </span>
          </td>
          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
            {fmtDate(app.startDate)}
          </td>
          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
            {fmtDate(app.endDate)}
          </td>
          <td className="px-4 py-3 text-center tabular-nums">{app.workingDays}</td>
          <td className="px-4 py-3 max-w-[180px]">
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {app.reason ?? '—'}
            </span>
          </td>
          <td className="px-4 py-3">
            <Badge variant={STATUS_VARIANT[app.status] ?? 'muted'} className="capitalize">
              {statusLabel(app.status)}
            </Badge>
          </td>
          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
            {fmtDate(app.createdAt)}
          </td>
          <td className="px-4 py-3">
            {['pending', 'approved'].includes(app.status) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleCancel(app.id)}
                disabled={isPending}
              >
                <XIcon className="mr-1 h-3.5 w-3.5" />
                Cancel
              </Button>
            )}
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

// ---------------------------------------------------------------------------
// PendingApprovalTable
// ---------------------------------------------------------------------------

interface PendingApprovalTableProps {
  applications: LeaveApplicationRowEnriched[];
  onApprove: (id: string, remarks?: string) => Promise<void>;
  onDisapprove: (id: string, remarks: string) => Promise<void>;
}

export function PendingApprovalTable({
  applications,
  onApprove,
  onDisapprove,
}: PendingApprovalTableProps) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === applications.length
        ? new Set()
        : new Set(applications.map((a) => a.id)),
    );
  }

  function handleBulkApprove() {
    if (selected.size === 0) return;
    startTransition(async () => {
      try {
        const result = await bulkApprove({ leaveApplicationIds: [...selected] });
        toast.success(
          `Approved ${result.approved} application${result.approved !== 1 ? 's' : ''}.${
            result.skipped > 0 ? ` ${result.skipped} skipped.` : ''
          }${result.errors.length > 0 ? ` ${result.errors.length} failed.` : ''}`,
        );
        setSelected(new Set());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Bulk approve failed.');
      }
    });
  }

  const headers = [
    '',
    'Applicant',
    'Leave Type',
    'Date From',
    'Date To',
    'Days',
    'Reason',
    'Filed On',
    'Actions',
  ];

  if (applications.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
        <CheckIcon className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No pending applications.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-senate-gold/30 bg-senate-cream/50 px-4 py-2.5">
          <span className="text-sm font-medium text-senate-navy">
            {selected.size} selected
          </span>
          <Button
            size="sm"
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
            onClick={handleBulkApprove}
            disabled={isPending}
          >
            <CheckIcon className="mr-1.5 h-3.5 w-3.5" />
            Approve Selected
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  className="rounded border-muted-foreground/30"
                  checked={selected.size === applications.length && applications.length > 0}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              {headers.slice(1).map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {applications.map((app) => (
              <tr
                key={app.id}
                className={cn(
                  'group hover:bg-muted/20 transition-colors',
                  selected.has(app.id) && 'bg-senate-cream/30',
                )}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="rounded border-muted-foreground/30"
                    checked={selected.has(app.id)}
                    onChange={() => toggleSelect(app.id)}
                    aria-label={`Select application for ${app.employeeFullName}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{app.employeeFullName}</div>
                  {app.employeeNo && (
                    <div className="text-xs text-muted-foreground">{app.employeeNo}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {LEAVE_TYPES[app.leaveTypeCode as LeaveTypeCode]?.name ?? app.leaveTypeName}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {fmtDate(app.startDate)}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {fmtDate(app.endDate)}
                </td>
                <td className="px-4 py-3 text-center tabular-nums">{app.workingDays}</td>
                <td className="px-4 py-3 max-w-[160px]">
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {app.reason ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                  {fmtDate(app.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <SingleApproveDisapprove
                        app={app}
                        onApprove={onApprove}
                        onDisapprove={onDisapprove}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Inline approve/disapprove per row (extracted for cleanliness)
function SingleApproveDisapprove({
  app,
  onApprove,
  onDisapprove,
}: {
  app: LeaveApplicationRowEnriched;
  onApprove: (id: string, remarks?: string) => Promise<void>;
  onDisapprove: (id: string, remarks: string) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [showRemarks, setShowRemarks] = useState(false);
  const [remarks, setRemarks] = useState('');

  function handleApprove() {
    startTransition(async () => {
      try {
        await onApprove(app.id);
        toast.success('Application approved.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to approve.');
      }
    });
  }

  function handleDisapprove() {
    if (!showRemarks) { setShowRemarks(true); return; }
    if (!remarks.trim() || remarks.trim().length < 5) {
      toast.error('Provide a reason (min 5 characters).');
      return;
    }
    startTransition(async () => {
      try {
        await onDisapprove(app.id, remarks.trim());
        toast.success('Application disapproved.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to disapprove.');
      }
    });
  }

  return (
    <div className={cn('flex flex-col gap-1', isPending && 'opacity-50 pointer-events-none')}>
      {showRemarks && (
        <textarea
          className="w-36 resize-none rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-senate-navy"
          rows={2}
          placeholder="Reason..."
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      )}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/30 text-destructive hover:bg-destructive/5 text-xs h-7 px-2"
          onClick={handleDisapprove}
          disabled={isPending}
        >
          <XIcon className="mr-1 h-3 w-3" />
          {showRemarks ? 'Confirm' : 'Disapprove'}
        </Button>
        <Button
          size="sm"
          className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-7 px-2"
          onClick={handleApprove}
          disabled={isPending}
        >
          <CheckIcon className="mr-1 h-3 w-3" />
          Approve
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AllApplicationsTable
// ---------------------------------------------------------------------------

interface AllApplicationsTableProps {
  applications: LeaveApplicationRowEnriched[];
  initialStatus?: string;
}

export function AllApplicationsTable({
  applications,
  initialStatus,
}: AllApplicationsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState(initialStatus ?? '');

  function applyFilter(status: string) {
    setStatusFilter(status);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'all');
    if (status) {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const handleExport = useCallback(() => {
    startTransition(async () => {
      try {
        const csv = await exportCsv({
          status: statusFilter || undefined,
        });
        if (!csv) {
          toast.info('No data to export.');
          return;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leave-applications-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exported.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Export failed.');
      }
    });
  }, [statusFilter]);

  const statuses = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'disapproved', label: 'Disapproved' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'recalled', label: 'Recalled' },
  ];

  const headers = [
    'Applicant',
    'Leave Type',
    'Date From',
    'Date To',
    'Days',
    'Reason',
    'Status',
    'Approver',
    'Approved At',
    'Filed On',
  ];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FilterIcon className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => applyFilter(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-senate-navy"
            aria-label="Filter by status"
          >
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            {applications.length} record{applications.length !== 1 ? 's' : ''}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isPending}
          className="text-xs"
        >
          <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      <TableShell headers={headers} empty={applications.length === 0}>
        {applications.map((app) => (
          <tr key={app.id} className="group hover:bg-muted/20 transition-colors">
            <td className="px-4 py-3">
              <div className="font-medium text-sm">{app.employeeFullName}</div>
              {app.employeeNo && (
                <div className="text-xs text-muted-foreground">{app.employeeNo}</div>
              )}
            </td>
            <td className="px-4 py-3 text-sm">
              {LEAVE_TYPES[app.leaveTypeCode as LeaveTypeCode]?.name ?? app.leaveTypeName}
            </td>
            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-sm">
              {fmtDate(app.startDate)}
            </td>
            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-sm">
              {fmtDate(app.endDate)}
            </td>
            <td className="px-4 py-3 text-center tabular-nums text-sm">{app.workingDays}</td>
            <td className="px-4 py-3 max-w-[160px]">
              <span className="line-clamp-2 text-xs text-muted-foreground">
                {app.reason ?? '—'}
              </span>
            </td>
            <td className="px-4 py-3">
              <Badge
                variant={STATUS_VARIANT[app.status] ?? 'muted'}
                className="capitalize text-xs"
              >
                {statusLabel(app.status)}
              </Badge>
            </td>
            <td className="px-4 py-3 text-xs text-muted-foreground">
              {app.approverName ?? '—'}
            </td>
            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
              {app.approvedAt ? fmtDate(app.approvedAt) : '—'}
            </td>
            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
              {fmtDate(app.createdAt)}
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}
