'use client';

/**
 * Client-side wrapper for the Plantilla list table.
 * Handles: column actions, assign/unassign dialogs, PDF export trigger.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DataTable } from '@/components/tables/data-table';
import { buildPlantillaColumns } from '@/components/plantilla/plantilla-columns';
import { AssignEmployeeDialog } from '@/components/plantilla/assign-employee-dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const [assignTarget, setAssignTarget] = useState<PlantillaPositionRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const columns = buildPlantillaColumns({
    onEdit: (row) => {
      router.push(`/plantilla/${row.id}/edit`);
    },
    onAssign: (row) => {
      setAssignTarget(row);
    },
    onUnassign: (row) => {
      startTransition(async () => {
        try {
          await unassignEmployee({ plantillaId: row.id });
          toast.success(`Position ${row.itemNo} marked as vacant.`);
          router.refresh();
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to unassign employee.';
          toast.error(message);
        }
      });
    },
  });

  function handleFilterChange(key: string, value: string | undefined) {
    const params = new URLSearchParams();
    if (currentFilters.search) params.set('search', currentFilters.search);
    if (currentFilters.officeId) params.set('officeId', currentFilters.officeId);
    if (currentFilters.salaryGrade)
      params.set('salaryGrade', String(currentFilters.salaryGrade));
    if (currentFilters.status !== 'all') params.set('status', currentFilters.status);

    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1');
    router.push(`/plantilla?${params.toString()}`);
  }

  const filledCount = rows.filter((r) => r.isFilled).length;
  const vacantCount = rows.filter((r) => !r.isFilled).length;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Positions', value: total },
          { label: 'Filled', value: filledCount },
          { label: 'Vacant', value: vacantCount },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card px-4 py-3 flex items-baseline gap-2"
          >
            <span className="text-2xl font-bold tabular-nums text-foreground">{value}</span>
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={currentFilters.officeId ?? 'all'}
          onValueChange={(v) => handleFilterChange('officeId', v)}
        >
          <SelectTrigger className="w-52">
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
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Grades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {Array.from({ length: 33 }, (_, i) => i + 1).map((sg) => (
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
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="filled">Filled</SelectItem>
            <SelectItem value="vacant">Vacant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search by item no. or position title…"
        pageSize={perPage}
        emptyMessage="No plantilla positions found matching your filters."
      />

      {/* Assign dialog */}
      <AssignEmployeeDialog
        open={assignTarget !== null}
        onOpenChange={(open) => { if (!open) setAssignTarget(null); }}
        position={assignTarget}
        employees={employees}
      />
    </div>
  );
}
