import type { Metadata } from 'next';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layouts/page-header';
import { AuditLogTable, type AuditLogRow } from '@/components/admin/audit-log-table';
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
  const supabase = await createServerClient();

  let query = supabase
    .from('audit_logs')
    .select(
      `
      id,
      created_at,
      action,
      table_name,
      record_id,
      old_values,
      new_values,
      ip_address,
      user_agent,
      user_id,
      system_users(email, employees(first_name, last_name))
    `,
    )
    .order('created_at', { ascending: false })
    .limit(500);

  if (params.userId) query = query.eq('user_id', params.userId);
  if (params.tableName) query = query.eq('table_name', params.tableName);
  if (params.action) query = query.eq('action', params.action);
  if (params.recordId) query = query.eq('record_id', params.recordId);
  if (params.dateFrom) query = query.gte('created_at', params.dateFrom);
  if (params.dateTo) query = query.lte('created_at', params.dateTo + 'T23:59:59Z');

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch audit logs: ${error.message}`);

  return (data ?? []).map((row) => {
    const sysUser = Array.isArray(row.system_users) ? row.system_users[0] : row.system_users;
    const emp = sysUser
      ? Array.isArray((sysUser as Record<string, unknown>)['employees'])
        ? ((sysUser as Record<string, unknown>)['employees'] as unknown[])[0]
        : (sysUser as Record<string, unknown>)['employees']
      : null;

    let userName: string | null = null;
    if (emp) {
      const e = emp as { first_name: string; last_name: string };
      userName = `${e.first_name} ${e.last_name}`;
    }

    return {
      id: row.id as string,
      timestamp: row.created_at as string,
      userName,
      userEmail: sysUser ? ((sysUser as Record<string, unknown>)['email'] as string) : null,
      action: row.action as string,
      tableName: row.table_name as string,
      recordId: row.record_id as string | null,
      oldValues: row.old_values as Record<string, unknown> | null,
      newValues: row.new_values as Record<string, unknown> | null,
      ipAddress: row.ip_address as string | null,
      userAgent: row.user_agent as string | null,
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
    </div>
  );
}
