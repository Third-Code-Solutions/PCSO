"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buildEmployeeColumns } from "./employee-table-columns";
import {
  deactivateEmployee,
  bulkDeactivate,
} from "@/app/(dashboard)/employees/actions";
import type { EmployeeListResult } from "@/app/(dashboard)/employees/queries";

interface EmployeeListTableProps {
  initialData: EmployeeListResult;
  currentPage: number;
  perPage: number;
}

const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

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
  const [confirmOne, setConfirmOne] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const handleDeactivate = (id: string, name: string) => {
    setConfirmOne({ id, name });
  };

  const commitDeactivateOne = () => {
    if (!confirmOne) return;
    const { id, name } = confirmOne;
    setConfirmOne(null);
    startTransition(async () => {
      try {
        await deactivateEmployee(id);
        toast.success(`${name} has been archived.`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to archive employee.",
        );
      }
    });
  };

  const handleBulkDeactivate = () => {
    const selectedIds = Object.keys(rowSelection).filter(
      (k) => rowSelection[k],
    );
    if (selectedIds.length === 0) return;
    setConfirmBulk(true);
  };

  const commitBulkDeactivate = () => {
    const selectedIds = Object.keys(rowSelection).filter(
      (k) => rowSelection[k],
    );
    setConfirmBulk(false);
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      try {
        const { deactivated } = await bulkDeactivate(selectedIds);
        toast.success(`${deactivated} employee(s) archived.`);
        setRowSelection({});
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Bulk archive failed.",
        );
      }
    });
  };

  const columns = useMemo(
    () => buildEmployeeColumns({ onDeactivate: handleDeactivate }),
    [],
  );

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

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    return params;
  };

  const navigateToPage = (page: number) => {
    const params = setParam("page", String(page));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const onPerPageChange = (raw: string) => {
    const next = Number(raw);
    if (!Number.isFinite(next)) return;
    const params = setParam("perPage", String(next));
    params.set("page", "1");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;
  const totalPages = Math.max(initialData.totalPages, 1);
  const showingFrom =
    initialData.total === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const showingTo = Math.min(currentPage * perPage, initialData.total);

  return (
    <div className="space-y-4">
      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-md bg-pcso-navy/5 px-4 py-2">
          <span className="text-sm font-medium text-pcso-navy">
            {selectedCount} selected
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleBulkDeactivate}
            disabled={isPending}
          >
            Archive Selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRowSelection({})}>
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-pcso-navy/5">
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="font-semibold text-pcso-navy"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
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
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      No employees found
                    </p>
                    <p className="text-xs">
                      Try adjusting your filters or search terms.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className="hover:bg-pcso-cream/40 data-[state=selected]:bg-pcso-gold/10"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span>
            {initialData.total === 0
              ? "No records"
              : `Showing ${showingFrom.toLocaleString()}–${showingTo.toLocaleString()} of ${initialData.total.toLocaleString()}`}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs">Rows per page</span>
            <Select value={String(perPage)} onValueChange={onPerPageChange}>
              <SelectTrigger
                className="h-8 w-[76px]"
                aria-label="Rows per page"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PER_PAGE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
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
          <span className="px-3 tabular-nums">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateToPage(currentPage + 1)}
            disabled={currentPage >= totalPages || isPending}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateToPage(totalPages)}
            disabled={currentPage >= totalPages || isPending}
          >
            Last
          </Button>
        </div>
      </div>

      {/* Single archive confirmation */}
      <AlertDialog
        open={confirmOne !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmOne(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive employee?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmOne
                ? `${confirmOne.name}'s record will be marked as resigned and hidden from active lists. The action is reversible by an administrator.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={commitDeactivateOne}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk archive confirmation */}
      <AlertDialog open={confirmBulk} onOpenChange={setConfirmBulk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Archive {selectedCount} employees?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Selected records will be marked as resigned and hidden from active
              lists. This action is reversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={commitBulkDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive {selectedCount}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
