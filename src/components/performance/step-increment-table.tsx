/**
 * StepIncrementTable — displays step increment records with status.
 *
 * Actions (approve, implement, cancel) are handled via form POSTs to
 * server actions — no client-component/server-action prop boundary issues.
 */

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';
import type { StepIncrementRow } from '@/app/(dashboard)/performance/queries';

interface StepIncrementTableProps {
  increments: StepIncrementRow[];
  showEmployee?: boolean;
  /** Optional server action bound functions passed from a server component wrapper */
  approveAction?: (formData: FormData) => Promise<void>;
  implementAction?: (formData: FormData) => Promise<void>;
  cancelAction?: (formData: FormData) => Promise<void>;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'muted' | 'destructive'> = {
  pending: 'warning',
  approved: 'info',
  implemented: 'success',
  cancelled: 'muted',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  implemented: 'Implemented',
  cancelled: 'Cancelled',
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function StepIncrementTable({
  increments,
  showEmployee = true,
  approveAction,
  implementAction,
  cancelAction,
}: StepIncrementTableProps) {
  if (increments.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        No step increment records found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            {showEmployee && (
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Employee
              </th>
            )}
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Step Change
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Effectivity Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Basis Periods
            </th>
            {(approveAction ?? implementAction ?? cancelAction) && (
              <th className="px-4 py-3" />
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {increments.map((inc) => (
            <tr key={inc.id} className="group hover:bg-muted/20 transition-colors">
              {showEmployee && (
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{inc.employeeName}</div>
                  <div className="text-xs text-muted-foreground">{inc.employeeNo}</div>
                </td>
              )}
              <td className="px-4 py-3">
                <span className="font-tabular-nums font-medium">
                  Step {inc.fromStep}
                </span>
                <span className="mx-1.5 text-muted-foreground">→</span>
                <span className="font-tabular-nums font-medium text-senate-navy">
                  Step {inc.toStep}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDate(inc.effectivityDate)}
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant={STATUS_VARIANT[inc.status] ?? 'muted'}
                >
                  {STATUS_LABEL[inc.status] ?? inc.status}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {inc.basisPeriodIds.slice(0, 3).map((pid) => (
                    <span
                      key={pid}
                      className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground font-mono"
                    >
                      {pid.slice(0, 8)}…
                    </span>
                  ))}
                </div>
              </td>
              {(approveAction ?? implementAction ?? cancelAction) && (
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {inc.status === 'pending' && approveAction && (
                      <form action={approveAction}>
                        <input type="hidden" name="stepIncrementId" value={inc.id} />
                        <SubmitButton label="Approve" variant="primary" />
                      </form>
                    )}
                    {inc.status === 'approved' && implementAction && (
                      <form action={implementAction}>
                        <input type="hidden" name="stepIncrementId" value={inc.id} />
                        <SubmitButton label="Implement" variant="primary" />
                      </form>
                    )}
                    {['pending', 'approved'].includes(inc.status) && cancelAction && (
                      <form action={cancelAction}>
                        <input type="hidden" name="stepIncrementId" value={inc.id} />
                        <input type="hidden" name="reason" value="Cancelled by HR" />
                        <SubmitButton label="Cancel" variant="danger" />
                      </form>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

interface SubmitButtonProps {
  label: string;
  variant: 'primary' | 'danger';
}

function SubmitButton({ label, variant }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      className={cn(
        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        variant === 'primary'
          ? 'bg-senate-navy text-senate-cream hover:bg-senate-navy-light'
          : 'text-red-700 hover:bg-red-50',
      )}
    >
      {label}
    </button>
  );
}
