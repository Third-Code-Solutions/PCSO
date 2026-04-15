'use client';

import * as React from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/tables/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { AuditLogDetailDialog } from './audit-log-detail-dialog';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuditLogRow {
  id: string;
  timestamp: string;
  userName: string | null;
  userEmail: string | null;
  action: string;
  tableName: string;
  recordId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
}

// ─── Action badge colors ──────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  approve: 'bg-purple-100 text-purple-800',
  export: 'bg-amber-100 text-amber-800',
  login: 'bg-gray-100 text-gray-700',
  password_reset_sent: 'bg-orange-100 text-orange-800',
};

// ─── Columns ─────────────────────────────────────────────────────────────────

function buildColumns(
  onView: (row: AuditLogRow) => void,
): ColumnDef<AuditLogRow>[] {
  return [
    {
      accessorKey: 'timestamp',
      header: 'Timestamp',
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {new Date(row.original.timestamp).toLocaleString('en-PH', {
            dateStyle: 'short',
            timeStyle: 'medium',
          })}
        </span>
      ),
    },
    {
      id: 'user',
      header: 'User',
      cell: ({ row }) => (
        <div className="text-sm">
          <div className="font-medium">{row.original.userName ?? 'System'}</div>
          {row.original.userEmail && (
            <div className="text-xs text-muted-foreground">{row.original.userEmail}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'action',
      header: 'Action',
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
            ACTION_COLORS[row.original.action] ?? 'bg-gray-100 text-gray-700'
          }`}
        >
          {row.original.action}
        </span>
      ),
    },
    {
      accessorKey: 'tableName',
      header: 'Table',
      cell: ({ row }) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
          {row.original.tableName}
        </code>
      ),
    },
    {
      accessorKey: 'recordId',
      header: 'Record ID',
      cell: ({ row }) =>
        row.original.recordId ? (
          <code className="text-xs text-muted-foreground">{row.original.recordId}</code>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: 'ipAddress',
      header: 'IP',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.ipAddress ?? '—'}
        </span>
      ),
    },
    {
      id: 'diff',
      header: '',
      cell: ({ row }) => {
        const hasValues =
          row.original.oldValues !== null || row.original.newValues !== null;
        return (
          <Button
            variant="ghost"
            size="icon"
            disabled={!hasValues}
            onClick={() => onView(row.original)}
            aria-label="View diff"
          >
            <Eye className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];
}

// ─── Component ───────────────────────────────────────────────────────────────

interface AuditLogTableProps {
  logs: AuditLogRow[];
}

export function AuditLogTable({ logs }: AuditLogTableProps) {
  const [selectedRow, setSelectedRow] = React.useState<AuditLogRow | null>(null);

  const columns = React.useMemo(() => buildColumns(setSelectedRow), []);

  return (
    <>
      <DataTable
        columns={columns}
        data={logs}
        searchPlaceholder="Search by user, table, action, or record ID…"
        emptyMessage="No audit log entries match the selected filters."
      />

      <AuditLogDetailDialog
        row={selectedRow}
        open={selectedRow !== null}
        onClose={() => setSelectedRow(null)}
      />
    </>
  );
}
