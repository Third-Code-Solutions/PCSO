'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, UserCheck, UserMinus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PlantillaPositionRow } from '@/app/(dashboard)/plantilla/queries';

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatPeso(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// ---------------------------------------------------------------------------
// Column action callbacks
// ---------------------------------------------------------------------------

export interface PlantillaColumnCallbacks {
  onEdit: (row: PlantillaPositionRow) => void;
  onAssign: (row: PlantillaPositionRow) => void;
  onUnassign: (row: PlantillaPositionRow) => void;
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

export function buildPlantillaColumns(
  callbacks: PlantillaColumnCallbacks,
): ColumnDef<PlantillaPositionRow>[] {
  return [
    {
      accessorKey: 'itemNo',
      header: 'Item No.',
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium text-muted-foreground">
          {row.getValue('itemNo')}
        </span>
      ),
    },
    {
      accessorKey: 'positionTitle',
      header: 'Position Title',
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue('positionTitle')}</span>
      ),
    },
    {
      accessorKey: 'salaryGrade',
      header: 'SG',
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono">
          SG-{row.getValue<number>('salaryGrade')}
        </Badge>
      ),
    },
    {
      accessorKey: 'authorizedSalary',
      header: 'Authorized Salary',
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums">
          {formatPeso(row.getValue('authorizedSalary'))}
        </span>
      ),
    },
    {
      accessorKey: 'officeName',
      header: 'Office',
      cell: ({ row }) => (
        <div>
          <div className="text-sm font-medium">{row.getValue('officeName')}</div>
          <div className="text-xs text-muted-foreground">{row.original.officeCode}</div>
        </div>
      ),
    },
    {
      accessorKey: 'employeeName',
      header: 'Incumbent',
      cell: ({ row }) => {
        const name = row.getValue<string | null>('employeeName');
        if (!name) {
          return <span className="text-muted-foreground italic text-sm">Vacant</span>;
        }
        return (
          <div>
            <div className="text-sm font-medium">{name}</div>
            <div className="text-xs text-muted-foreground font-mono">
              {row.original.employeeNo}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'isFilled',
      header: 'Status',
      cell: ({ row }) => {
        const filled = row.getValue<boolean>('isFilled');
        return filled ? (
          <Badge variant="success">Filled</Badge>
        ) : (
          <Badge variant="warning">Vacant</Badge>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const position = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => callbacks.onEdit(position)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit position
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {position.isFilled ? (
                <DropdownMenuItem
                  onClick={() => callbacks.onUnassign(position)}
                  className="text-destructive focus:text-destructive"
                >
                  <UserMinus className="mr-2 h-4 w-4" />
                  Mark as vacant
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => callbacks.onAssign(position)}>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Assign employee
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
