'use client';

/**
 * SendAllRemindersButton — client wrapper for the non-filers bulk reminder action.
 *
 * Wraps the server action with useTransition + toast so admins get immediate
 * feedback when firing bulk reminders. Triggers router.refresh() so the page
 * re-reads the compliance list (if any filings landed between render + click).
 */

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface SendAllRemindersButtonProps {
  sendAll: () => Promise<{ sent: number; failed: number; skipped?: number }>;
  nonFilerCount: number;
}

export function SendAllRemindersButton({ sendAll, nonFilerCount }: SendAllRemindersButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const result = await sendAll();
        const desc =
          result.failed > 0
            ? `${result.failed} reminder(s) failed — check email addresses.`
            : result.skipped
              ? `${result.skipped} already reminded today.`
              : undefined;
        toast.success(`Reminders sent to ${result.sent} employee(s)`, { description: desc });
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to send reminders.';
        toast.error('Bulk send failed', { description: msg });
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      disabled={isPending || nonFilerCount === 0}
      onClick={handleClick}
      aria-label="Send reminders to all non-filers"
    >
      {isPending ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Mail className="mr-1.5 h-4 w-4" aria-hidden />
      )}
      {isPending ? 'Sending…' : 'Send Reminders to All'}
    </Button>
  );
}
