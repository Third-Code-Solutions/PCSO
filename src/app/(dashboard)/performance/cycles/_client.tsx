'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updatePeriodStatus } from '../actions';
import { PERIOD_STATUS_LABEL } from '@/lib/constants/performance';

interface StatusSelectProps {
  periodId: string;
  currentStatus: 'open' | 'rating' | 'review' | 'closed';
}

/**
 * Inline status selector — HR admin can advance a cycle through its lifecycle.
 */
export function StatusSelect({ periodId, currentStatus }: StatusSelectProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState(currentStatus);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleChange(next: string): Promise<void> {
    if (next === status) return;
    setSaving(true);
    setError(null);
    try {
      await updatePeriodStatus({ periodId, status: next });
      setStatus(next as StatusSelectProps['currentStatus']);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Select value={status} onValueChange={handleChange} disabled={saving}>
        <SelectTrigger className="h-8 w-[132px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(['open', 'rating', 'review', 'closed'] as const).map((s) => (
            <SelectItem key={s} value={s}>
              {PERIOD_STATUS_LABEL[s] ?? s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <span className="text-[11px] text-destructive">{error}</span>}
    </div>
  );
}
