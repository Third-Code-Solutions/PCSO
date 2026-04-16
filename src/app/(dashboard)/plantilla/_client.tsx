'use client';

/**
 * Client-side wrapper for the Plantilla list table.
 *
 * Responsibilities:
 * - Server-side pagination (URL driven)
 * - Debounced search
 * - Filter bar (office, salary grade, status)
 * - Row actions (assign/unassign/edit)
 *
 * The parent server component supplies the current page of rows along with
 * the aggregated total count so the pagination buttons and "showing X of Y"
 * label stay accurate across pages.
 */

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Search, X } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buildPlantillaColumns } from '@/components/plantilla/plantilla-columns';
import { AssignEmployeeDialog } from '@/components/plantilla/assign-employee-dialog';
import { useDebounce } from '@/hooks/use-debounce';
import { unassignEmployee } from './actions';
import type { PlantillaPositionRow, OfficeRow, EmployeeSelectorRow } from './queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CurrentFilters {
  search?: string;
  officeId?: string;
  salaryGrade?: number;
  status: string;
}

interface PlantillaTableClientProps {
  rows: PlantillaPositionRow[];
  total: number;
  offices: OfficeRow[];
  page: number;
  perPage: number;
  currentFilters: CurrentFilters;
  employees?: EmployeeSelectorRow[];
}

const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
const SALARY_GRADES = Array.from({ length: 33 }, (_, i) => i + 1);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlantillaTableClient({
  rows,
  total,
  offices,
  page,
  perPage,
  currentFilters,
  employees = [],
}: PlantillaTableClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [assignTarget, setAssignTarget] = useState<PlantillaPositionRow | null>(null);
  const [unassignTarget, setUnassignTarget] =
    useState<PlantillaPositionRow | null>(null);

  // Controlled search input (debounced).
  const [searchValue, setSearchValue] = useState(currentFilters.search ?? '');
  const debouncedSearch = useDebounce(searchValue, 350);

  const setParam = (key: string, value: string | null): URLSearchParams => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    return params;
  };

  const pushParams = (params: URLSearchParams) => {
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // Sync debounced search to URL.
  useEffect(() => {
    const current = searchParams.get('search') ?? '';
    if (debouncedSearch === current) return;
    const params = setParam('search', debouncedSearch.trim() || null);
    params.set('page', '1');
    pushParams(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Keep local in sync with URL (e.g. after Clear).
  useEffect(() => {
    setSearchValue(searchParams.get('search') ?? '');
  }, [searchParams]);

  const commitUnassign = () => {
    if (!unassignTarget) return;
    const target = unassignTarget;
    setUnassignTarget(null);
    startTransition(async () => {
      try {
        await unassignEmployee({ plantillaId: target.id });
        toast.success(`Position ${target.itemNo} marked as vacant.`);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to unassign employee.';
        toast.error(message);
      }
    });
  };

  const columns = useMemo(
    () =>
      buildPlantillaColumns({
        onEdit: (row) => {
          router.push(`/plantilla/${row.id}/edit`);
        },
        onAssign: (row) => setAssignTarget(row),
        onUnassign: (row) => setUnassignTarget(row),
      }),
    [router],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const handleFilterChange = (key: string, value: string | undefined) => {
    const params = setParam(key, value && value !== 'all' ? value : null);
    params.set('page', '1');
    pushParams(params);
  };

  const navigateToPage = (nextPage: number) => {
    const params = setParam('page', String(nextPage));
    pushParams(params);
  };

  const onPerPageChange = (raw: string) => {
    const next = Number(raw);
    if (!Number.isFinite(next)) return;
    const params = setParam('perPage', String(next));
    params.set('page', '1');
    pushParams(params);
  };

  const clearFilters = () => {
    setSearchValue('');
    startTransition(() => {
      router.push(pathname);
    });
  };

  const hasFilters =
    Boolean(currentFilters.search) ||
    Boolean(currentFilters.officeId) ||
    Boolean(currentFilters.salaryGrade) ||
    currentFilters.status !== 'all';

  const totalPages = Math.max(Math.ceil(total / perPage), 1);
  const showingFrom = total === 0 ? 0 : (page - 1) * perPage + 1;
  const showingTo = Math.min(page * perPage, total);
  const filledOnPage = rows.filter((r) => r.isFilled).length;
  const vacantOnPage = rows.length - filledOnPage;

  return (
    <div className="space-y-4" aria-busy={isPending}>
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Positions', value: total },
          { label: `Filled (page ${page})`, value: filledOnPage },
          { label: `Vacant (page ${page})`, value: vacantOnPage },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card px-4 py-3 flex items-baseline gap-2"
          >
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {value.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by item no. or position title…"
            value={searchValue}
            className="pl-9"
            onChange={(e) => setSearchValue(e.target.value)}
            aria-label="Search positions"
          />
        </div>

        <Select
          value={currentFilters.officeId ?? 'all'}
          onValueChange={(v) => handleFilterChange('officeId', v)}
        >
          <SelectTrigger className="w-52" aria-label="Filter by office">
            <SelectValue placeholder="All Offices" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Offices</SelectItem>
            {offices.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentFilters.salaryGrade ? String(currentFilters.salaryGrade) : 'all'}
          onValueChange={(v) => handleFilterChange('salaryGrade', v)}
        >
          <SelectTrigger className="w-40" aria-label="Filter by salary grade">
            <SelectValue placeholder="All Grades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {SALARY_GRADES.map((sg) => (
              <SelectItem key={sg} value={String(sg)}>
                SG-{sg}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentFilters.status}
          onValueChange={(v) => handleFilterChange('status', v)}
        >
          <SelectTrigger className="w-36" aria-label="Filter by status">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="filled">Filled</SelectItem>
            <SelectItem value="vacant">Vacant</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-12 text-center text-muted-foreground"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      No plantilla positions found
                    </p>
                    <p className="text-xs">
                      Try clearing filters or add a new position.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-senate-cream/40"
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
      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span>
            {total === 0
              ? 'No records'
              : `Showing ${showingFrom.toLocaleString()}–${showingTo.toLocaleString()} of ${total.toLocaleString()}`}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs">Rows per page</span>
            <Select value={String(perPage)} onValueChange={onPerPageChange}>
              <SelectTrigger className="h-8 w-[76px]" aria-label="Rows per page">
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
            disabled={page === 1 || isPending}
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateToPage(page - 1)}
            disabled={page === 1 || isPending}
          >
            Previous
          </Button>
          <span className="px-3 tabular-nums">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateToPage(page + 1)}
            disabled={page >= totalPages || isPending}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateToPage(totalPages)}
            disabled={page >= totalPages || isPending}
          >
            Last
          </Button>
        </div>
      </div>

      {/* Assign dialog */}
      <AssignEmployeeDialog
        open={assignTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAssignTarget(null);
        }}
        position={assignTarget}
        employees={employees}
      />

      {/* Unassign confirmation */}
      <AlertDialog
        open={unassignTarget !== null}
        onOpenChange={(open) => {
          if (!open) setUnassignTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark position as vacant?</AlertDialogTitle>
            <AlertDialogDescription>
              {unassignTarget
                ? `Item ${unassignTarget.itemNo} — ${unassignTarget.positionTitle} — will be unassigned from ${unassignTarget.employeeName ?? 'its current incumbent'}.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={commitUnassign}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Mark as vacant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
