/**
 * LeaveApprovalCard — compact card for the pending approvals queue.
 * Displays key application details with approve/disapprove quick actions.
 */

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LEAVE_TYPES } from '@/lib/constants/leave-types';
import type { LeaveTypeCode } from '@/lib/constants/leave-types';
import { cn } from '@/lib/utils/cn';
import { CalendarIcon, UserIcon, CheckIcon, XIcon, ChevronRightIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { LeaveApplicationRow } from '@/app/(dashboard)/leave/queries';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LeaveApprovalCardProps {
  application: LeaveApplicationRow & {
    employeeNo?: string;
    employeeFullName?: string;
  };
  onApprove: (id: string, remarks?: string) => Promise<void>;
  onDisapprove: (id: string, remarks: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeaveApprovalCard({
  application,
  onApprove,
  onDisapprove,
}: LeaveApprovalCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showRemarks, setShowRemarks] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'disapprove' | null>(null);

  const leaveType =
    LEAVE_TYPES[application.leaveTypeCode as LeaveTypeCode] ?? null;

  function handleApprove() {
    setActionType('approve');
    setShowRemarks(false);
    startTransition(async () => {
      try {
        await onApprove(application.id, remarks || undefined);
        toast.success('Leave application approved.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to approve.');
      }
    });
  }

  function handleDisapprove() {
    if (!showRemarks) {
      setActionType('disapprove');
      setShowRemarks(true);
      return;
    }
    if (!remarks.trim() || remarks.trim().length < 5) {
      toast.error('Please provide a reason for disapproval (minimum 5 characters).');
      return;
    }
    startTransition(async () => {
      try {
        await onDisapprove(application.id, remarks.trim());
        toast.success('Leave application disapproved.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to disapprove.');
      }
    });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm',
        'transition-shadow hover:shadow-md',
        isPending && 'opacity-70 pointer-events-none',
      )}
    >
      {/* Leave type color strip */}
      <div
        className="absolute inset-y-0 left-0 w-1 rounded-l-xl"
        style={{
          backgroundColor: leaveType?.withPay ? '#0B2545' : '#6b7280',
        }}
      />

      <div className="pl-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold truncate">
                {application.employeeFullName ?? 'Employee'}
              </h3>
              {application.employeeNo && (
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {application.employeeNo}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {leaveType?.name ?? application.leaveTypeCode}
              {!leaveType?.withPay && ' (Without Pay)'}
            </p>
          </div>
          <Badge variant="warning" className="shrink-0 text-xs">
            Pending
          </Badge>
        </div>

        {/* Date range + days */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarIcon className="h-3.5 w-3.5" />
            {formatDate(application.startDate)} – {formatDate(application.endDate)}
          </span>
          <span className="font-medium text-foreground">
            {application.workingDays}{' '}
            {application.workingDays === 1 ? 'day' : 'days'}
          </span>
        </div>

        {/* Reason */}
        {application.reason && (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground italic">
            &ldquo;{application.reason}&rdquo;
          </p>
        )}

        {/* Remarks input */}
        {showRemarks && (
          <div className="mt-3">
            <label
              htmlFor={`remarks-${application.id}`}
              className="mb-1 block text-xs font-medium text-foreground"
            >
              Reason for Disapproval <span className="text-destructive">*</span>
            </label>
            <textarea
              id={`remarks-${application.id}`}
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-senate-navy"
              rows={2}
              placeholder="Provide a reason..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            asChild
          >
            <Link href={`/leave/approvals/${application.id}`}>
              View Details
              <ChevronRightIcon className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/30 text-destructive hover:bg-destructive/5 text-xs"
              onClick={handleDisapprove}
              disabled={isPending}
            >
              <XIcon className="mr-1 h-3.5 w-3.5" />
              {showRemarks && actionType === 'disapprove' ? 'Confirm' : 'Disapprove'}
            </Button>
            <Button
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
              onClick={handleApprove}
              disabled={isPending}
            >
              <CheckIcon className="mr-1 h-3.5 w-3.5" />
              Approve
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
