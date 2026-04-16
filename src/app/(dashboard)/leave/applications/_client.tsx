'use client';

/**
 * Leave Applications browser — client components
 *
 * Exports:
 *  - TabSwitcher          : URL-driven tab navigation
 *  - FilterToolbar        : status / leave-type / date / search / page-size
 *  - Pagination           : URL-preserving pagination with page-size selector
 *  - TableSkeleton        : shimmer skeleton shown via Suspense fallback
 *  - MyApplicationsTable  : own applications with cancel action
 *  - PendingApprovalTable : approval queue with inline + bulk approve
 *  - AllApplicationsTable : full filterable history + CSV export
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  useTransition,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import Link from 'next/link';
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
  SearchIcon,
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
// Types shared with the page
// ---------------------------------------------------------------------------

export type TabKey = 'mine' | 'pending' | 'all';

export interface AllFilters {
  status?: string;
  leaveType?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
}

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

const LEAVE_TYPE_OPTIONS = (Object.keys(LEAVE_TYPES) as LeaveTypeCode[]).map(
  (code) => ({
    value: code,
    label: LEAVE_TYPES[code]?.name ?? code,
  }),
);

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

/**
 * Build a `/leave/applications?...` URL that preserves the active tab,
 * filters, and page size, while letting the caller override any field.
 * Fields set to `undefined` are removed from the URL.
 */
function buildUrl(
  tab: TabKey,
  filters: AllFilters,
  pageSize: number,
  overrides: Record<string, string | number | undefined> = {},
): string {
  const usp = new URLSearchParams();
  usp.set('tab', tab);
  if (filters.status) usp.set('status', filters.status);
  if (filters.leaveType) usp.set('leaveType', filters.leaveType);
  if (filters.dateFrom) usp.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) usp.set('dateTo', filters.dateTo);
  if (filters.q) usp.set('q', filters.q);
  if (pageSize !== 50) usp.set('pageSize', String(pageSize));

  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === null || v === '') {
      usp.delete(k);
    } else {
      usp.set(k, String(v));
    }
  }

  return `/leave/applications?${usp.toString()}`;
}

/**
 * In-browser post-filter for leaveType and text-search. Applied within the
 * currently loaded page. Note: for workspaces with >50 records this narrows
 * the current page only; the server already applied status + date filters.
 */
function applyClientFilters<T extends LeaveApplicationRowEnriched>(
  rows: T[],
  filters: AllFilters,
): T[] {
  const needle = filters.q?.trim().toLowerCase();
  const leaveType = filters.leaveType?.trim();

  if (!needle && !leaveType) return rows;

  return rows.filter((r) => {
    if (leaveType && r.leaveTypeCode !== leaveType) return false;
    if (needle) {
      const hay = [
        r.employeeFullName,
        r.employeeNo,
        r.reason ?? '',
        r.leaveTypeName,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// TabSwitcher
// ---------------------------------------------------------------------------

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
// FilterToolbar — status + leave type + date range + search + page size
// ---------------------------------------------------------------------------

interface FilterToolbarProps {
  activeTab: TabKey;
  filters: AllFilters;
  pageSize: number;
  pageSizes: readonly number[];
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'disapproved', label: 'Disapproved' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'recalled', label: 'Recalled' },
];

export function FilterToolbar({
  activeTab,
  filters,
  pageSize,
  pageSizes,
}: FilterToolbarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [local, setLocal] = useState<AllFilters>(filters);
  const [announce, setAnnounce] = useState<string>('');

  // Keep local state in sync when a navigation changes the URL.
  useEffect(() => {
    setLocal(filters);
  }, [filters.status, filters.leaveType, filters.dateFrom, filters.dateTo, filters.q]);

  const push = useCallback(
    (next: AllFilters, nextPageSize: number = pageSize) => {
      startTransition(() => {
        router.push(
          buildUrl(activeTab, next, nextPageSize, { page: 1 }),
          { scroll: false },
        );
      });
    },
    [activeTab, pageSize, router],
  );

  const submit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      push(local);
      const activeFilterCount = Object.values(local).filter(
        (v) => v && String(v).length > 0,
      ).length;
      setAnnounce(
        activeFilterCount === 0
          ? 'Filters cleared.'
          : `Applied ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}.`,
      );
    },
    [local, push],
  );

  const reset = useCallback(() => {
    const cleared: AllFilters = {};
    setLocal(cleared);
    push(cleared);
    setAnnounce('Filters cleared.');
  }, [push]);

  const activeCount = useMemo(
    () => Object.values(filters).filter((v) => v && String(v).length > 0).length,
    [filters],
  );

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-2 rounded-lg border bg-card px-3 py-3 shadow-sm"
      aria-label="Filter leave applications"
    >
      {/* aria-live region for filter announcements */}
      <span className="sr-only" aria-live="polite" role="status">
        {announce}
      </span>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-status" className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Status
        </label>
        <select
          id="filter-status"
          value={local.status ?? ''}
          onChange={(e) =>
            setLocal((p) => ({ ...p, status: e.target.value || undefined }))
          }
          disabled={activeTab === 'pending'}
          className="h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-senate-gold disabled:opacity-60"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-leave-type" className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Leave Type
        </label>
        <select
          id="filter-leave-type"
          value={local.leaveType ?? ''}
          onChange={(e) =>
            setLocal((p) => ({ ...p, leaveType: e.target.value || undefined }))
          }
          className="h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-senate-gold"
        >
          <option value="">All types</option>
          {LEAVE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-date-from" className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          From
        </label>
        <input
          id="filter-date-from"
          type="date"
          value={local.dateFrom ?? ''}
          onChange={(e) =>
            setLocal((p) => ({ ...p, dateFrom: e.target.value || undefined }))
          }
          className="h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-senate-gold"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-date-to" className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          To
        </label>
        <input
          id="filter-date-to"
          type="date"
          value={local.dateTo ?? ''}
          onChange={(e) =>
            setLocal((p) => ({ ...p, dateTo: e.target.value || undefined }))
          }
          className="h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-senate-gold"
        />
      </div>

      <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
        <label htmlFor="filter-q" className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Search
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <input
            id="filter-q"
            type="search"
            placeholder="Name, employee no., reason"
            value={local.q ?? ''}
            onChange={(e) =>
              setLocal((p) => ({ ...p, q: e.target.value || undefined }))
            }
            className="h-8 w-full rounded-md border bg-background pl-8 pr-2 text-sm focus:outline-none focus:ring-1 focus:ring-senate-gold"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-page-size" className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Rows
        </label>
        <select
          id="filter-page-size"
          value={pageSize}
          onChange={(e) => push(local, Number.parseInt(e.target.value, 10))}
          className="h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-senate-gold"
        >
          {pageSizes.map((n) => (
            <option key={n} value={n}>
              {n}/page
            </option>
          ))}
        </select>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {activeCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={reset}
            disabled={isPending}
            className="text-xs"
          >
            Clear {activeCount}
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={isPending}
          className="text-xs"
        >
          <FilterIcon className="mr-1.5 h-3.5 w-3.5" />
          Apply
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Pagination — URL-preserving
// ---------------------------------------------------------------------------

interface PaginationProps {
  activeTab: TabKey;
  filters: AllFilters;
  pageSize: number;
  page: number;
  totalPages: number;
  total: number;
}

export function Pagination({
  activeTab,
  filters,
  pageSize,
  page,
  totalPages,
  total,
}: PaginationProps) {
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-4 py-2.5"
    >
      <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
        {total === 0
          ? 'No applications.'
          : `Showing ${firstRow}–${lastRow} of ${total}`}
      </span>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
            {page > 1 ? (
              <Link href={buildUrl(activeTab, filters, pageSize, { page: prev })}>
                Prev
              </Link>
            ) : (
              <span>Prev</span>
            )}
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            asChild={page < totalPages}
          >
            {page < totalPages ? (
              <Link href={buildUrl(activeTab, filters, pageSize, { page: next })}>
                Next
              </Link>
            ) : (
              <span>Next</span>
            )}
          </Button>
        </div>
      )}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// TableSkeleton — Suspense fallback
// ---------------------------------------------------------------------------

export function TableSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-xl border"
      role="status"
      aria-label="Loading leave applications"
    >
      <div className="h-10 border-b bg-muted/40" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-4 border-b px-4 py-3 last:border-b-0"
        >
          <div className="h-3 w-36 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-3 w-10 rounded bg-muted" />
          <div className="h-3 flex-1 rounded bg-muted" />
          <div className="h-3 w-16 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared table shell
// ---------------------------------------------------------------------------

function TableShell({
  headers,
  children,
  empty,
  emptyMessage = 'No applications match these filters.',
}: {
  headers: string[];
  children: React.ReactNode;
  empty?: boolean;
  emptyMessage?: string;
}) {
  if (empty) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/10">
        <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            {headers.map((h, i) => (
              <th
                key={`${h}-${i}`}
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  function handleCancel(id: string) {
    setCancellingId(id);
    startTransition(async () => {
      try {
        await cancelLeaveApplication({ leaveApplicationId: id });
        toast.success('Leave application cancelled.');
        router.refresh();
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
    <TableShell
      headers={headers}
      empty={applications.length === 0}
      emptyMessage="You haven't filed any leave applications yet."
    >
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
  filters: AllFilters;
  onApprove: (id: string, remarks?: string) => Promise<void>;
  onDisapprove: (id: string, remarks: string) => Promise<void>;
}

export function PendingApprovalTable({
  applications,
  filters,
  onApprove,
  onDisapprove,
}: PendingApprovalTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () => applyClientFilters(applications, filters),
    [applications, filters],
  );

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((a) => a.id)),
    );
  }

  function handleBulkApprove() {
    if (selected.size === 0) return;
    startTransition(async () => {
      try {
        const result = await bulkApprove({ leaveApplicationIds: [...selected] });
        const escalated = result.escalated ?? 0;
        toast.success(
          `Approved ${result.approved} application${result.approved !== 1 ? 's' : ''}.${
            escalated > 0 ? ` ${escalated} escalated to HR.` : ''
          }${result.skipped > 0 ? ` ${result.skipped} skipped.` : ''}${
            result.errors.length > 0 ? ` ${result.errors.length} failed.` : ''
          }`,
        );
        setSelected(new Set());
        router.refresh();
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

  if (filtered.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/10">
        <CheckIcon className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">
          {applications.length === 0
            ? 'No pending applications. All caught up.'
            : 'No applications match these filters.'}
        </p>
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
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setSelected(new Set())}
            disabled={isPending}
          >
            Clear
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
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  aria-label="Select all on this page"
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
            {filtered.map((app) => (
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
                  <SingleApproveDisapprove
                    app={app}
                    onApprove={onApprove}
                    onDisapprove={onDisapprove}
                  />
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showRemarks, setShowRemarks] = useState(false);
  const [remarks, setRemarks] = useState('');

  function handleApprove() {
    startTransition(async () => {
      try {
        await onApprove(app.id);
        toast.success('Application approved.');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to approve.');
      }
    });
  }

  function handleDisapprove() {
    if (!showRemarks) {
      setShowRemarks(true);
      return;
    }
    if (!remarks.trim() || remarks.trim().length < 5) {
      toast.error('Provide a reason (min 5 characters).');
      return;
    }
    startTransition(async () => {
      try {
        await onDisapprove(app.id, remarks.trim());
        toast.success('Application disapproved.');
        router.refresh();
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
          aria-label="Reason for disapproval"
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
  filters: AllFilters;
}

export function AllApplicationsTable({
  applications,
  filters,
}: AllApplicationsTableProps) {
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () => applyClientFilters(applications, filters),
    [applications, filters],
  );

  const handleExport = useCallback(() => {
    startTransition(async () => {
      try {
        const csv = await exportCsv({
          status: filters.status,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
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
  }, [filters.status, filters.dateFrom, filters.dateTo]);

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
      {/* Export toolbar */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {filtered.length} record{filtered.length !== 1 ? 's' : ''} on this page
          {applications.length !== filtered.length
            ? ` (filtered from ${applications.length})`
            : ''}
        </span>
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

      <TableShell headers={headers} empty={filtered.length === 0}>
        {filtered.map((app) => (
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
