'use client';

/**
 * NewOvertimeRequestForm — client component for the /attendance/overtime/new page.
 *
 * Wires the form directly to `submitOvertimeRequest` from
 * ../actions.ts (the ROBUST wrapper with duplicate-date guard and
 * supervisor notification). Uses `useTransition` to disable the
 * submit button while the action is in flight to prevent double-submit.
 *
 * On success: fires a toast, refreshes the router cache, then navigates
 * to /attendance/overtime. On failure: surfaces the server error via
 * sonner toast.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import {
  OvertimeRequestSchema,
  type OvertimeRequestInput,
} from '@/lib/validations/attendance';
import { submitOvertimeRequest } from '../actions';

interface SupervisorOption {
  id: string;
  name: string;
}

interface NewOvertimeRequestFormProps {
  employeeId: string;
  supervisors: SupervisorOption[];
}

const DAY_TYPE_OPTIONS: Array<{
  value: OvertimeRequestInput['dayType'];
  label: string;
}> = [
  { value: 'ordinary', label: 'Ordinary Working Day (regular)' },
  { value: 'rest_day', label: 'Rest Day' },
  { value: 'special_non_working', label: 'Special Non-Working Holiday' },
  { value: 'regular_holiday', label: 'Regular Holiday' },
  { value: 'rest_day_and_special', label: 'Rest Day + Special Holiday' },
  {
    value: 'rest_day_and_regular_holiday',
    label: 'Rest Day + Regular Holiday',
  },
];

const MIN_MINUTES = 30;
const MAX_MINUTES = 240;
const DEFAULT_MINUTES = 60;

export function NewOvertimeRequestForm({
  employeeId,
  supervisors,
}: NewOvertimeRequestFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof OvertimeRequestInput, string>>
  >({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});

    const formEl = event.currentTarget;
    const formData = new FormData(formEl);

    const rawMinutes = formData.get('requestedMinutes');
    const parsedMinutes =
      typeof rawMinutes === 'string' && rawMinutes.trim().length > 0
        ? Number.parseInt(rawMinutes, 10)
        : Number.NaN;

    const candidate = {
      employeeId,
      date: String(formData.get('date') ?? ''),
      requestedMinutes: parsedMinutes,
      dayType: String(
        formData.get('dayType') ?? 'ordinary',
      ) as OvertimeRequestInput['dayType'],
      justification: String(formData.get('justification') ?? '').trim(),
      supervisorId: String(formData.get('supervisorId') ?? ''),
    };

    const result = OvertimeRequestSchema.safeParse(candidate);
    if (!result.success) {
      const nextErrors: Partial<Record<keyof OvertimeRequestInput, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof OvertimeRequestInput | undefined;
        if (key && !nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      toast.error('Please correct the highlighted fields.');
      return;
    }

    startTransition(async () => {
      try {
        await submitOvertimeRequest(result.data);
        toast.success(
          'Overtime request submitted. Your supervisor has been notified.',
        );
        router.refresh();
        router.push('/attendance/overtime');
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to submit overtime request.';
        toast.error(message);
      }
    });
  }

  const disabled = isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isPending}>
      {/* Date */}
      <div className="space-y-1.5">
        <Label htmlFor="ot-date">Date</Label>
        <Input
          id="ot-date"
          name="date"
          type="date"
          required
          disabled={disabled}
          aria-invalid={Boolean(fieldErrors.date)}
        />
        {fieldErrors.date ? (
          <p className="text-xs text-red-600">{fieldErrors.date}</p>
        ) : null}
      </div>

      {/* Day type */}
      <div className="space-y-1.5">
        <Label htmlFor="ot-day-type">Day Type</Label>
        <select
          id="ot-day-type"
          name="dayType"
          defaultValue="ordinary"
          required
          disabled={disabled}
          aria-invalid={Boolean(fieldErrors.dayType)}
          className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {DAY_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {fieldErrors.dayType ? (
          <p className="text-xs text-red-600">{fieldErrors.dayType}</p>
        ) : null}
      </div>

      {/* Requested minutes */}
      <div className="space-y-1.5">
        <Label htmlFor="ot-minutes">Requested Overtime (minutes)</Label>
        <Input
          id="ot-minutes"
          name="requestedMinutes"
          type="number"
          min={MIN_MINUTES}
          max={MAX_MINUTES}
          step={30}
          defaultValue={DEFAULT_MINUTES}
          required
          disabled={disabled}
          aria-invalid={Boolean(fieldErrors.requestedMinutes)}
        />
        <p className="text-xs text-muted-foreground">
          Minimum {MIN_MINUTES}, maximum {MAX_MINUTES} minutes (4 hours) per
          day.
        </p>
        {fieldErrors.requestedMinutes ? (
          <p className="text-xs text-red-600">
            {fieldErrors.requestedMinutes}
          </p>
        ) : null}
      </div>

      {/* Supervisor */}
      <div className="space-y-1.5">
        <Label htmlFor="ot-supervisor">Immediate Supervisor</Label>
        <select
          id="ot-supervisor"
          name="supervisorId"
          defaultValue=""
          required
          disabled={disabled || supervisors.length === 0}
          aria-invalid={Boolean(fieldErrors.supervisorId)}
          className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="" disabled>
            {supervisors.length === 0
              ? 'No supervisors available'
              : 'Select supervisor'}
          </option>
          {supervisors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {fieldErrors.supervisorId ? (
          <p className="text-xs text-red-600">{fieldErrors.supervisorId}</p>
        ) : null}
      </div>

      {/* Justification */}
      <div className="space-y-1.5">
        <Label htmlFor="ot-justification">Justification</Label>
        <Textarea
          id="ot-justification"
          name="justification"
          rows={4}
          required
          minLength={20}
          maxLength={1000}
          disabled={disabled}
          placeholder="Describe the work to be performed during overtime and why it cannot be completed during regular hours (min. 20 characters)."
          aria-invalid={Boolean(fieldErrors.justification)}
        />
        {fieldErrors.justification ? (
          <p className="text-xs text-red-600">{fieldErrors.justification}</p>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="ghost" asChild disabled={disabled}>
          <Link href="/attendance/overtime">Cancel</Link>
        </Button>
        <Button type="submit" disabled={disabled}>
          {isPending ? 'Submitting…' : 'Submit Overtime Request'}
        </Button>
      </div>
    </form>
  );
}
