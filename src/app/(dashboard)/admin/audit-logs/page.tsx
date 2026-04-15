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
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Audit Logs — Admin' };

// ─── Types ───────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<Record<string, string | string[]>>;
}

// ─── Data fetching ────────────────────────────────────────────────────────────

interface AuditQueryParams {
  userId?: string;
  tableName?: string;
  action?: string;
  recordId?: string;
  dateFrom?: string;
  dateTo?: string;
}

async function getAuditLogs(params: AuditQueryParams): Promise<AuditLogRow[]> {
  // Use Drizzle directly — Supabase PostgREST can't auto-resolve audit_logs->system_users
  // without an explicit FK constraint, and we don't want one (audit logs reference
  // potentially-deleted users).
  const { db } = await import('@/lib/db');
  const { auditLogs, systemUsers, employees } = await import('@/lib/db/schema');
  const { and, eq, gte, lte, desc, sql } = await import('drizzle-orm');

  const conditions = [];
  if (params.userId) conditions.push(eq(auditLogs.userId, params.userId));
  if (params.tableName) conditions.push(eq(auditLogs.tableName, params.tableName));
  if (params.action) conditions.push(eq(auditLogs.action, params.action));
  if (params.recordId) conditions.push(eq(auditLogs.recordId, params.recordId));
  if (params.dateFrom) conditions.push(gte(auditLogs.createdAt, new Date(params.dateFrom)));
  if (params.dateTo)
    conditions.push(lte(auditLogs.createdAt, new Date(params.dateTo + 'T23:59:59Z')));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      action: auditLogs.action,
      tableName: auditLogs.tableName,
      recordId: auditLogs.recordId,
      oldValues: auditLogs.oldValues,
      newValues: auditLogs.newValues,
      ipAddress: auditLogs.ipAddress,
      userAgent: auditLogs.userAgent,
      userId: auditLogs.userId,
      sysUserEmail: systemUsers.email,
      empFirstName: employees.firstName,
      empLastName: employees.lastName,
    })
    .from(auditLogs)
    .leftJoin(systemUsers, eq(systemUsers.id, auditLogs.userId))
    .leftJoin(employees, eq(employees.id, systemUsers.employeeId))
    .where(whereClause ?? sql`true`)
    .orderBy(desc(auditLogs.createdAt))
    .limit(500);

  return rows.map((row) => {
    const userName =
      row.empFirstName && row.empLastName ? `${row.empFirstName} ${row.empLastName}` : null;

    return {
      id: row.id,
      timestamp: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      userName,
      userEmail: row.sysUserEmail ?? null,
      action: row.action,
      tableName: row.tableName,
      recordId: row.recordId,
      oldValues: row.oldValues as Record<string, unknown> | null,
      newValues: row.newValues as Record<string, unknown> | null,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
    };
  });
}

// ─── Filter bar (server-rendered form) ───────────────────────────────────────

function FilterBar({ params }: { params: AuditQueryParams & { dateFrom?: string; dateTo?: string } }) {
  return (
    <form method="GET" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1">
        <Label htmlFor="filter-table" className="text-xs">Table</Label>
        <Input
          id="filter-table"
          name="tableName"
          placeholder="e.g. employees"
          defaultValue={params.tableName ?? ''}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filter-action" className="text-xs">Action</Label>
        <Input
          id="filter-action"
          name="action"
          placeholder="create, update, delete…"
          defaultValue={params.action ?? ''}
          className="h-8 text-sm"
        />
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
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function AuditLogsPage({ searchParams }: PageProps) {
  await requirePermission('admin', 'view');

  const raw = await searchParams;
  const flat = (k: string) => (Array.isArray(raw[k]) ? raw[k][0] : raw[k]) as string | undefined;

  const queryParams: AuditQueryParams = {
    userId: flat('userId'),
    tableName: flat('tableName'),
    action: flat('action'),
    recordId: flat('recordId'),
    dateFrom: flat('dateFrom'),
    dateTo: flat('dateTo'),
  };

  const logs = await getAuditLogs(queryParams);

  // Build export query string
  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries(queryParams)) {
    if (v) exportParams.set(k, v);
  }
  const exportHref = `/admin/audit-logs/export?${exportParams.toString()}`;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Audit Logs"
        description={`Immutable COA-ready activity log. ${logs.length.toLocaleString()} entries (max 500 — apply filters to narrow).`}
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

      <FilterBar params={queryParams} />

      <AuditLogTable logs={logs} />

      {/* Realtime: auto-refreshes the log list when new audit entries are written */}
      <RealtimeBoundary tables={['audit_logs']} />
    </div>
  );
}
