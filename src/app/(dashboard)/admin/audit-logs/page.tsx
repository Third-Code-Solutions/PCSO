import type { Metadata } from 'next';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layouts/page-header';
import { AuditLogTable, type AuditLogRow } from '@/components/admin/audit-log-table';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import { requirePermission } from '@/lib/auth/guards';
import {
  getAuditLogsPage,
  getAuditFilterOptions,
  type AuditQueryParams,
} from './queries';

export const metadata: Metadata = { title: 'Audit Logs — Admin' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[]>>;
}

// ─── Filter bar (server-rendered form with select dropdowns) ─────────────────

interface FilterBarProps {
  params: AuditQueryParams;
  options: {
    tables: string[];
    actions: string[];
    users: { id: string; email: string; name: string | null }[];
  };
}

function FilterBar({ params, options }: FilterBarProps) {
  return (
    <form
      method="GET"
      className="grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="space-y-1">
        <Label htmlFor="filter-userId" className="text-xs">Actor</Label>
        <select
          id="filter-userId"
          name="userId"
          defaultValue={params.userId ?? ''}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Any user</option>
          {options.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ? `${u.name} — ${u.email}` : u.email}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="filter-table" className="text-xs">Table</Label>
        <select
          id="filter-table"
          name="tableName"
          defaultValue={params.tableName ?? ''}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Any table</option>
          {options.tables.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="filter-action" className="text-xs">Action</Label>
        <select
          id="filter-action"
          name="action"
          defaultValue={params.action ?? ''}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Any action</option>
          {options.actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="filter-recordId" className="text-xs">Record ID</Label>
        <Input
          id="filter-recordId"
          name="recordId"
          placeholder="UUID"
          defaultValue={params.recordId ?? ''}
          className="h-8 text-sm font-mono"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filter-dateFrom" className="text-xs">Date From</Label>
        <Input
          id="filter-dateFrom"
          name="dateFrom"
          type="date"
          defaultValue={params.dateFrom ?? ''}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filter-dateTo" className="text-xs">Date To</Label>
        <Input
          id="filter-dateTo"
          name="dateTo"
          type="date"
          defaultValue={params.dateTo ?? ''}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filter-pageSize" className="text-xs">Rows / page</Label>
        <select
          id="filter-pageSize"
          name="pageSize"
          defaultValue={String(params.pageSize ?? 50)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200">200</option>
        </select>
      </div>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit" size="sm" className="bg-senate-navy text-white hover:bg-senate-navy-light">
          Apply filters
        </Button>
        <Button type="reset" variant="outline" size="sm" asChild>
          <Link href="/admin/audit-logs">Clear</Link>
        </Button>
      </div>
    </form>
  );
}

// ─── Pagination strip ────────────────────────────────────────────────────────

function PaginationStrip({
  page,
  totalPages,
  total,
  pageSize,
  searchParams,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  searchParams: Record<string, string | undefined>;
}) {
  function buildUrl(nextPage: number): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== 'page') sp.set(k, v);
    }
    sp.set('page', String(nextPage));
    return `/admin/audit-logs?${sp.toString()}`;
  }

  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium">{startRow.toLocaleString()}</span>–
        <span className="font-medium">{endRow.toLocaleString()}</span> of{' '}
        <span className="font-medium">{total.toLocaleString()}</span> entries
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild disabled={page <= 1}>
          <Link href={buildUrl(Math.max(1, page - 1))} aria-disabled={page <= 1}>
            Previous
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          Page <span className="font-medium">{page.toLocaleString()}</span> of{' '}
          <span className="font-medium">{totalPages.toLocaleString()}</span>
        </span>
        <Button variant="outline" size="sm" asChild disabled={page >= totalPages}>
          <Link href={buildUrl(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages}>
            Next
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

function flatten(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function AuditLogsPage({ searchParams }: PageProps) {
  await requirePermission('admin', 'view');

  const raw = await searchParams;
  const flat = (k: string) => flatten(raw[k]);

  const pageSizeRaw = flat('pageSize');
  const pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : 50;
  const pageRaw = flat('page');
  const page = pageRaw ? parseInt(pageRaw, 10) : 1;

  const queryParams: AuditQueryParams = {
    userId: flat('userId'),
    tableName: flat('tableName'),
    action: flat('action'),
    recordId: flat('recordId'),
    dateFrom: flat('dateFrom'),
    dateTo: flat('dateTo'),
    page,
    pageSize,
  };

  const [pageResult, filterOptions] = await Promise.all([
    getAuditLogsPage(queryParams),
    getAuditFilterOptions(),
  ]);

  // Build export query string (omit page/pageSize so exports cover the filter, not the page)
  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries(queryParams)) {
    if (k === 'page' || k === 'pageSize') continue;
    if (v) exportParams.set(k, String(v));
  }
  const exportHref = `/admin/audit-logs/export?${exportParams.toString()}`;

  const rows: AuditLogRow[] = pageResult.rows;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Audit Logs"
        description="Immutable COA-ready activity log. Every create, update, delete, approve, and export is recorded here."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin', href: '/admin' },
          { label: 'Audit Logs' },
        ]}
        actions={
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link href={exportHref}>
              <Download className="h-4 w-4" />
              Export Excel
            </Link>
          </Button>
        }
      />

      <FilterBar params={queryParams} options={filterOptions} />

      <AuditLogTable logs={rows} />

      <PaginationStrip
        page={pageResult.page}
        totalPages={pageResult.totalPages}
        total={pageResult.total}
        pageSize={pageResult.pageSize}
        searchParams={{
          userId: queryParams.userId,
          tableName: queryParams.tableName,
          action: queryParams.action,
          recordId: queryParams.recordId,
          dateFrom: queryParams.dateFrom,
          dateTo: queryParams.dateTo,
          pageSize: String(pageResult.pageSize),
        }}
      />

      {/* Realtime: auto-refreshes the log list when new audit entries are written */}
      <RealtimeBoundary tables={['audit_logs']} />
    </div>
  );
}
