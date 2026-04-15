'use client';

import * as React from 'react';
import Link from 'next/link';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/tables/data-table';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader as ColumnHeader } from '@/components/tables/column-header';
import { AlertTriangle } from 'lucide-react';
import type { PayrollRecordWithEmployee } from '@/app/(dashboard)/payroll/queries';
import type { PayrollRecordStatus } from '@/lib/db/schema';

interface RecordsTableProps {
  records: PayrollRecordWithEmployee[];
  periodId: string;
}

const RECORD_STATUS_COLORS: Record<PayrollRecordStatus, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  override: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paid: 'bg-[#C8A84B] text-white border-[#C8A84B]',
};

function formatPeso(value: string | null): string {
  if (!value) return '₱0.00';
  const num = parseFloat(value);
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fullName(emp: PayrollRecordWithEmployee['employee']): string {
  const parts = [emp.lastName, emp.firstName];
  if (emp.middleName) parts[1] = `${emp.firstName} ${emp.middleName.charAt(0)}.`;
  return parts.join(', ');
}

export function RecordsTable({ records, periodId }: RecordsTableProps) {
  const columns: ColumnDef<PayrollRecordWithEmployee>[] = [
    {
      id: 'employee',
      accessorFn: (r) => `${r.employee.lastName} ${r.employee.firstName}`,
      header: ({ column }) => <ColumnHeader column={column} title="Employee" />,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <Link
            href={`/payroll/${periodId}/records/${r.id}`}
            className="group flex flex-col"
          >
            <span className="font-medium text-[#0B2545] group-hover:underline">
              {fullName(r.employee)}
            </span>
            <span className="text-xs text-muted-foreground">{r.employee.employeeNo}</span>
          </Link>
        );
      },
    },
    {
      accessorKey: 'positionTitle',
      header: ({ column }) => <ColumnHeader column={column} title="Position" />,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.original.positionTitle}</span>
          {row.original.employee.officeName && (
            <span className="text-xs text-muted-foreground">
              {row.original.employee.officeName}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'salaryGrade',
      accessorFn: (r) => `SG ${r.salaryGrade}-${r.step}`,
      header: ({ column }) => <ColumnHeader column={column} title="SG/Step" />,
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          SG {row.original.salaryGrade}-{row.original.step}
        </span>
      ),
    },
    {
      accessorKey: 'grossPay',
      header: ({ column }) => (
        <ColumnHeader column={column} title="Gross Pay" className="text-right" />
      ),
      cell: ({ row }) => (
        <span className="block text-right font-mono text-sm">
          {formatPeso(row.original.grossPay)}
        </span>
      ),
    },
    {
      accessorKey: 'totalDeductions',
      header: ({ column }) => (
        <ColumnHeader column={column} title="Deductions" className="text-right" />
      ),
      cell: ({ row }) => (
        <span className="block text-right font-mono text-sm text-red-600">
          ({formatPeso(row.original.totalDeductions)})
        </span>
      ),
    },
    {
      accessorKey: 'netPay',
      header: ({ column }) => (
        <ColumnHeader column={column} title="Net Pay" className="text-right" />
      ),
      cell: ({ row }) => (
        <span className="block text-right font-mono text-sm font-semibold">
          {formatPeso(row.original.netPay)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <ColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.original.status as PayrollRecordStatus;
        return (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-xs ${RECORD_STATUS_COLORS[status]}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
            {row.original.hasException && (
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-label="Has exception" />
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Link
          href={`/payroll/${periodId}/records/${row.original.id}`}
          className="text-sm text-[#0B2545] hover:underline"
        >
          View
        </Link>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={records}
      searchPlaceholder="Search by employee name or ID..."
      emptyMessage="No payroll records. Process the payroll to generate records."
    />
  );
}
