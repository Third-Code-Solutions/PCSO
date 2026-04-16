'use client';

/**
 * SalnReviewPanel — compliance-office review controls for a single SALN.
 *
 * Rendered only for super_admin on /saln/[id]. Lets the reviewer mark a
 * submission as received / verified / deficient with optional remarks.
 * All actions flow through the server action `reviewSaln` and are audited.
 */

import * as React from 'react';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle, Inbox, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { SalnStatus } from '@/lib/validations/saln';

interface SalnReviewPanelProps {
  submissionId: string;
  currentStatus: SalnStatus;
  currentRemarks: string | null;
  onReview: (input: {
    id: string;
    status: 'received' | 'verified' | 'deficient';
    remarks?: string;
  }) => Promise<{ id: string }>;
}

export function SalnReviewPanel({
  submissionId,
  currentStatus,
  currentRemarks,
  onReview,
}: SalnReviewPanelProps) {
  const [remarks, setRemarks] = React.useState<string>(currentRemarks ?? '');
  const [isPending, startTransition] = React.useTransition();
  const [targetStatus, setTargetStatus] = React.useState<
    'received' | 'verified' | 'deficient' | null
  >(null);

  const canReview = currentStatus !== 'draft';

  function handleSubmit(status: 'received' | 'verified' | 'deficient') {
    if (status === 'deficient' && remarks.trim().length === 0) {
      toast.error('Remarks required', {
        description: 'Please explain what makes this SALN deficient.',
      });
      return;
    }
    setTargetStatus(status);
    startTransition(async () => {
      try {
        await onReview({
          id: submissionId,
          status,
          remarks: remarks.trim() ? remarks.trim() : undefined,
        });
        const friendly: Record<string, string> = {
          received: 'Marked as received',
          verified: 'Marked as verified',
          deficient: 'Flagged as deficient',
        };
        toast.success(friendly[status] ?? 'SALN updated', {
          description: 'The employee has been notified of the status change.',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Review failed.';
        toast.error('Review failed', { description: message });
      } finally {
        setTargetStatus(null);
      }
    });
  }

  if (!canReview) {
    return (
      <div className="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        This submission is still in <strong>draft</strong>. It must be submitted
        by the employee before compliance review.
      </div>
    );
  }

  return (
    <section
      aria-labelledby="review-panel-heading"
      className="rounded-md border border-senate-gold/40 bg-senate-cream p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-senate-navy" aria-hidden />
        <h2 id="review-panel-heading" className="text-sm font-semibold text-senate-navy">
          Compliance Review
        </h2>
      </div>

      <div className="mb-3">
        <Label htmlFor="review-remarks" className="text-xs">
          Remarks (required if marking deficient)
        </Label>
        <Textarea
          id="review-remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Enter any remarks, findings, or reasons for deficiency..."
          className="mt-1 min-h-[80px] text-sm"
          maxLength={1000}
          aria-describedby="remarks-help"
        />
        <p id="remarks-help" className="mt-1 text-[11px] text-muted-foreground">
          Remarks are visible to the employee and included in the audit trail.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending || currentStatus === 'received'}
          onClick={() => handleSubmit('received')}
        >
          <Inbox className="mr-1.5 h-4 w-4" aria-hidden />
          {isPending && targetStatus === 'received' ? 'Saving...' : 'Mark Received'}
        </Button>

        <Button
          type="button"
          size="sm"
          className="bg-senate-navy text-white hover:bg-senate-navy-light"
          disabled={isPending || currentStatus === 'verified'}
          onClick={() => handleSubmit('verified')}
        >
          <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />
          {isPending && targetStatus === 'verified' ? 'Saving...' : 'Verify'}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={() => handleSubmit('deficient')}
        >
          <AlertTriangle className="mr-1.5 h-4 w-4" aria-hidden />
          {isPending && targetStatus === 'deficient' ? 'Saving...' : 'Flag Deficient'}
        </Button>

        <p className="ml-auto text-[11px] text-muted-foreground">
          Every review is audited and the employee is notified.
        </p>
      </div>
    </section>
  );
}
