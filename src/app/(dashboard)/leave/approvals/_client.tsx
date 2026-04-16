/**
 * Leave Approvals — client shell.
 * Renders the selectable pending queue with:
 *   - per-row approve / deny (with required remarks on deny)
 *   - bulk-select + batch approve
 *   - server-side pagination controls
 *
 * The underlying card is `LeaveApprovalCard` (shared) for visual consistency.
 */

'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LeaveApprovalCard } from '@/components/leave/leave-approval-card';
import { LEAVE_TYPES } from '@/lib/constants/leave-types';
import type { LeaveTypeCode } from '@/lib/constants/leave-types';
import { cn } from '@/lib/utils/cn';
import {
  CheckIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  WalletIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type { PendingApprovalRow } from '@/app/(dashboard)/leave/queries';
import {
  approveLeave,
  disapproveLeave,
  batchApproveLeaves,
} from '@/app/(dashboard)/leave/actions';

interface LeaveApprovalsClientProps {
  rows: PendingApprovalRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function LeaveApprovalsClient({
  rows,
  page,
  pageSize,
  total,
  totalPages,
}: LeaveApprovalsClientProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBatchPending, startBatch] = useTransition();

  async function handleApprove(id: string, remarks?: string): Promise<void> {
    await approveLeave({ leaveApplicationId: id, remarks });
    router.refresh();
  }

  async function handleDisapprove(id: string, remarks: string): Promise<void> {
    await disapproveLeave({ leaveApplicationId: id, remarks });
    router.refresh();
  }

  const allSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.id)),
    [rows, selected],
  );

  function toggleOne(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(): void {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }

  function runBatchApprove(): void {
    const ids = [...selected];
    if (ids.length === 0) {
      toast.info('Select at least one application.');
      return;
    }

    startBatch(async () => {
      try {
        const result = await batchApproveLeaves({ leaveApplicationIds: ids });
        const parts: string[] = [];
        if (result.processed > 0) parts.push(`${result.processed} approved`);
        if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
        if (result.errors.length > 0) parts.push(`${result.errors.length} failed`);
        const msg = parts.join(' • ');
        if (result.errors.length > 0)
          toast.warning(msg || 'Batch completed with errors.');
        else toast.success(msg || 'Batch approved.');
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Batch approval failed.');
      }
    });
  }

  function buildPageLink(target: number): string {
    return `/leave/approvals?page=${target}&pageSize=${pageSize}`;
  }

  return (
    <div className="space-y-4">
      {/* Batch action bar + select-all row */}
      <div
        className={cn(
          'sticky top-16 z-10 flex flex-wrap items-center justify-between gap-3',
          'rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur',
        )}
      >
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={allSelected}
            onChange={toggleAll}
            aria-label="Select all applications on this page"
          />
          <span>
            {selected.size === 0
              ? `Select applications to batch approve`
              : `${selected.size} selected`}
          </span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {total} total
          </span>
          <Button
            size="sm"
            className="bg-emerald-700 text-white hover:bg-emerald-800"
            disabled={selected.size === 0 || isBatchPending}
            onClick={runBatchApprove}
          >
            <CheckIcon className="mr-1.5 h-4 w-4" />
            {isBatchPending
              ? 'Approving…'
              : `Batch Approve${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </Button>
        </div>
      </div>

      {/* Grid of approval rows */}
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((app) => (
          <ApprovalRow
            key={app.id}
            app={app}
            selected={selected.has(app.id)}
            onToggle={() => toggleOne(app.id)}
            onApprove={handleApprove}
            onDisapprove={handleDisapprove}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          aria-label="Approvals pagination"
          className="flex items-center justify-center gap-2 pt-2"
        >
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={buildPageLink(page - 1)}>
                <ChevronLeftIcon className="mr-1 h-4 w-4" /> Previous
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeftIcon className="mr-1 h-4 w-4" /> Previous
            </Button>
          )}
          <span className="text-xs text-muted-foreground px-2">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={buildPageLink(page + 1)}>
                Next <ChevronRightIcon className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next <ChevronRightIcon className="ml-1 h-4 w-4" />
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single approval row — wraps LeaveApprovalCard with selection + balance info
// ---------------------------------------------------------------------------

interface ApprovalRowProps {
  app: PendingApprovalRow;
  selected: boolean;
  onToggle: () => void;
  onApprove: (id: string, remarks?: string) => Promise<void>;
  onDisapprove: (id: string, remarks: string) => Promise<void>;
}

function ApprovalRow({
  app,
  selected,
  onToggle,
  onApprove,
  onDisapprove,
}: ApprovalRowProps) {
  const leaveType = LEAVE_TYPES[app.leaveTypeCode as LeaveTypeCode];
  const isAccrued =
    app.leaveTypeCode === 'VL' || app.leaveTypeCode === 'SL';

  return (
    <div
      className={cn(
        'relative rounded-xl ring-1 ring-transparent transition',
        selected && 'ring-senate-navy/40 shadow-md',
      )}
    >
      {/* Checkbox overlay */}
      <label
        className={cn(
          'absolute left-3 top-3 z-10 flex h-6 w-6 cursor-pointer items-center',
          'justify-center rounded-md border bg-background/95 shadow-sm',
        )}
      >
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select application ${app.id.slice(0, 8)}`}
        />
      </label>

      {/* Balance / meta strip above the card */}
      {isAccrued && app.currentBalance !== null && (
        <div className="flex items-center gap-2 rounded-t-xl border border-b-0 bg-muted/40 px-5 py-1.5 pl-12 text-xs">
          <WalletIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Current {app.leaveTypeCode} balance:</span>
          <span className="font-mono font-medium tabular-nums">
            {app.currentBalance.toFixed(3)}
          </span>
          <span className="text-muted-foreground">days</span>
          {app.balanceAfterDeduction !== null && (
            <Badge variant="muted" className="ml-auto text-xs">
              <CalendarIcon className="mr-1 h-3 w-3" />
              {app.workingDays} day{app.workingDays === 1 ? '' : 's'} requested
            </Badge>
          )}
        </div>
      )}
      {!isAccrued && (
        <div className="flex items-center gap-2 rounded-t-xl border border-b-0 bg-muted/40 px-5 py-1.5 pl-12 text-xs text-muted-foreground">
          <span>{leaveType?.name ?? app.leaveTypeCode}</span>
          {leaveType && !leaveType.withPay && (
            <Badge variant="muted" className="text-[10px]">
              Without Pay
            </Badge>
          )}
        </div>
      )}

      <LeaveApprovalCard
        application={app}
        onApprove={onApprove}
        onDisapprove={onDisapprove}
      />
    </div>
  );
}
