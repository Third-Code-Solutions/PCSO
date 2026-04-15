'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { assignEmployee } from '@/app/(dashboard)/plantilla/actions';
import type { EmployeeSelectorRow, PlantillaPositionRow } from '@/app/(dashboard)/plantilla/queries';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AssignEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: PlantillaPositionRow | null;
  employees: EmployeeSelectorRow[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssignEmployeeDialog({
  open,
  onOpenChange,
  position,
  employees,
}: AssignEmployeeDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const filtered = employees.filter((emp) => {
    const q = search.toLowerCase();
    return (
      emp.firstName.toLowerCase().includes(q) ||
      emp.lastName.toLowerCase().includes(q) ||
      emp.employeeNo.toLowerCase().includes(q) ||
      emp.positionTitle.toLowerCase().includes(q)
    );
  });

  async function handleAssign() {
    if (!position || !selectedId) return;
    setIsPending(true);
    try {
      await assignEmployee({
        plantillaId: position.id,
        employeeId: selectedId,
      });
      toast.success('Employee assigned to position.');
      setSelectedId(null);
      setSearch('');
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign employee.';
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  }

  function handleClose() {
    setSelectedId(null);
    setSearch('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Employee</DialogTitle>
          {position && (
            <DialogDescription>
              Assign an employee to{' '}
              <span className="font-semibold">{position.positionTitle}</span> (
              {position.itemNo})
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="employee-search">Search employee</Label>
            <Input
              id="employee-search"
              placeholder="Name or employee number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No employees found.
              </p>
            ) : (
              filtered.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => setSelectedId(emp.id)}
                  className={[
                    'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                    selectedId === emp.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted',
                  ].join(' ')}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {emp.lastName}, {emp.firstName}
                    </div>
                    <div
                      className={[
                        'text-xs truncate',
                        selectedId === emp.id
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground',
                      ].join(' ')}
                    >
                      {emp.employeeNo} · {emp.positionTitle}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selectedId || isPending}>
            {isPending ? 'Assigning…' : 'Assign Employee'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
