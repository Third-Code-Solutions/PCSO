'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { buildEmployeeColumns } from './employee-table-columns';
import { deactivateEmployee, bulkDeactivate } from '@/app/(dashboard)/employees/actions';
import type { EmployeeListResult } from '@/app/(dashboard)/employees/queries';

interface EmployeeListTableProps {
  initialData: EmployeeListResult;
  currentPage: number;
  perPage: number;
}

export function EmployeeListTable({
  initialData,
  currentPage,
  perPage,
}: EmployeeListTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const handleDeactivate = (id: string, name: string) => {
    if (!confirm(`Deactivate ${name}? This will soft-delete the record.`)) return;
    startTransition(async () => {
      try {
        await deactivateEmployee(id);
        toast.success(`${name} has been deactivated.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to deactivate employee.');
      }
    });
  };

  const handleBulkDeactivate = () => {
    const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
    if (selectedIds.length === 0) return;
    if (!confirm(`Deactivate ${selectedIds.length} selected employee(s)?`)) return;

    startTransition(async () => {
      try {
        const { deactivated } = await bulkDeactivate(selectedIds);
        toast.success(`${deactivated} employee(s) deactivated.`);
        setRowSelection({});
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Bulk deactivation failed.');
      }
    });
  };

  const columns = buildEmployeeColumns({ onDeactivate: handleDeactivate });

  const table = useReactTable({
    data: initialData.data,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
    pageCount: initialData.totalPages,
  });

  const navigateToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`${pathname}?${params.toString()}`);
  };

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-md bg-senate-navy/5 px-4 py-2">
          <span className="text-sm font-medium text-senate-navy">
            {selectedCount} selected
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleBulkDeactivate}
            disabled={isPending}
          >
            Deactivate Selected
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRowSelection({})}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-senate-navy/5">
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="font-semibold text-senate-navy"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-12 text-center text-muted-foreground"
                >
                  No employees found. Try adjusting your filters.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className="hover:bg-senate-cream/40 data-[state=selected]:bg-senate-gold/10"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {(currentPage - 1) * perPage + 1}–
          {Math.min(currentPage * perPage, initialData.total)} of{' '}
          {initialData.total.toLocaleString()} records
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateToPage(1)}
            disabled={currentPage === 1 || isPending}
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateToPage(currentPage - 1)}
            disabled={currentPage === 1 || isPending}
          >
            Previous
          </Button>
          <span className="px-3">
            Page {currentPage} of {initialData.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateToPage(currentPage + 1)}
            disabled={currentPage >= initialData.totalPages || isPending}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateToPage(initialData.totalPages)}
            disabled={currentPage >= initialData.totalPages || isPending}
          >
            Last
          </Button>
        </div>
      </div>
    </div>
  );
}
