'use client';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { MoreHorizontal, UserX, Eye, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { APPOINTMENT_TYPE_LABELS } from '@/lib/constants/appointment-types';
import { fullName } from '@/lib/utils/format';
import type { EmployeeListRow } from '@/app/(dashboard)/employees/queries';

function getStatusVariant(
  status: EmployeeListRow['status'],
): 'success' | 'warning' | 'destructive' | 'muted' {
  switch (status) {
    case 'active':
      return 'success';
    case 'on_leave':
      return 'warning';
    case 'suspended':
      return 'warning';
    case 'resigned':
    case 'terminated':
    case 'deceased':
      return 'destructive';
    case 'retired':
      return 'muted';
    default:
      return 'muted';
  }
}

function formatStatus(status: EmployeeListRow['status']): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFullName(row: EmployeeListRow): string {
  return fullName({
    firstName: row.firstName,
    middleName: row.middleName,
    lastName: row.lastName,
    suffix: row.suffix,
  });
}

type ColumnActions = {
  onDeactivate: (id: string, name: string) => void;
};

export function buildEmployeeColumns(actions: ColumnActions): ColumnDef<EmployeeListRow>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border border-input accent-senate-navy"
          checked={table.getIsAllPageRowsSelected()}
          onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
          aria-label="Select all rows on this page"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border border-input accent-senate-navy"
          checked={row.getIsSelected()}
          onChange={(e) => row.toggleSelected(e.target.checked)}
          aria-label={`Select ${formatFullName(row.original)}`}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'employeeNo',
      header: 'Employee No.',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.employeeNo}</span>
      ),
    },
    {
      id: 'fullName',
      header: 'Full Name',
      cell: ({ row }) => (
        <Link
          href={`/employees/${row.original.id}`}
          className="font-medium text-senate-navy hover:text-senate-gold hover:underline"
        >
          {formatFullName(row.original)}
        </Link>
      ),
    },
    {
      accessorKey: 'positionTitle',
      header: 'Position',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.positionTitle}</span>
      ),
    },
    {
      id: 'office',
      header: 'Office',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.officeName ?? '—'}
        </span>
      ),
    },
    {
      id: 'sgStep',
      header: 'SG / Step',
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          SG-{row.original.salaryGrade} / {row.original.step}
        </span>
      ),
    },
    {
      accessorKey: 'appointmentType',
      header: 'Appointment',
      cell: ({ row }) => {
        const label =
          APPOINTMENT_TYPE_LABELS[
            row.original.appointmentType as keyof typeof APPOINTMENT_TYPE_LABELS
          ] ?? row.original.appointmentType;
        return <Badge variant="secondary">{label}</Badge>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.status)}>
          {formatStatus(row.original.status)}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const emp = row.original;
        const fullName = formatFullName(emp);
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${fullName}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/employees/${emp.id}`} className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  View Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/employees/${emp.id}/edit`} className="flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center gap-2 text-destructive focus:text-destructive"
                onClick={() => actions.onDeactivate(emp.id, fullName)}
              >
                <UserX className="h-4 w-4" />
                Deactivate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
