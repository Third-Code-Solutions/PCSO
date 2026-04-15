'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { OvertimeRequestSchema, type OvertimeRequestInput } from '@/lib/validations/attendance';
import { requestOvertime } from '@/app/(dashboard)/attendance/actions';

interface OvertimeFormProps {
  employeeId: string;
  supervisors: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
}

const DAY_TYPE_LABELS: Record<OvertimeRequestInput['dayType'], string> = {
  ordinary: 'Ordinary Working Day (×1.25)',
  special_non_working: 'Special Non-Working Holiday (×1.3)',
  regular_holiday: 'Regular Holiday (×2.6)',
  rest_day: 'Rest Day (×1.3)',
  rest_day_and_special: 'Rest Day + Special Holiday (×1.5)',
  rest_day_and_regular_holiday: 'Rest Day + Regular Holiday (×2.6)',
};

export function OvertimeForm({ employeeId, supervisors, onSuccess }: OvertimeFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OvertimeRequestInput>({
    resolver: zodResolver(OvertimeRequestSchema),
    defaultValues: {
      employeeId,
      dayType: 'ordinary',
      requestedMinutes: 60,
    },
  });

  async function onSubmit(data: OvertimeRequestInput) {
    try {
      await requestOvertime(data);
      toast.success('Overtime request submitted successfully.');
      reset();
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit OT request';
      toast.error(message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <input type="hidden" {...register('employeeId')} />

      {/* Date */}
      <div>
        <label htmlFor="ot-date" className="block text-sm font-medium text-[#0B2545]">
          Date
        </label>
        <input
          id="ot-date"
          type="date"
          {...register('date')}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#C8A84B] focus:outline-none focus:ring-1 focus:ring-[#C8A84B]"
        />
        {errors.date && (
          <p className="mt-1 text-xs text-red-600">{errors.date.message}</p>
        )}
      </div>

      {/* Day type */}
      <div>
        <label htmlFor="ot-day-type" className="block text-sm font-medium text-[#0B2545]">
          Day Type
        </label>
        <select
          id="ot-day-type"
          {...register('dayType')}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#C8A84B] focus:outline-none focus:ring-1 focus:ring-[#C8A84B]"
        >
          {(Object.entries(DAY_TYPE_LABELS) as [OvertimeRequestInput['dayType'], string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>
        {errors.dayType && (
          <p className="mt-1 text-xs text-red-600">{errors.dayType.message}</p>
        )}
      </div>

      {/* Requested minutes */}
      <div>
        <label htmlFor="ot-minutes" className="block text-sm font-medium text-[#0B2545]">
          Requested Overtime (minutes)
        </label>
        <input
          id="ot-minutes"
          type="number"
          min={30}
          max={240}
          step={30}
          {...register('requestedMinutes', { valueAsNumber: true })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#C8A84B] focus:outline-none focus:ring-1 focus:ring-[#C8A84B]"
        />
        <p className="mt-0.5 text-xs text-gray-400">Maximum 240 minutes (4 hours) per day.</p>
        {errors.requestedMinutes && (
          <p className="mt-1 text-xs text-red-600">{errors.requestedMinutes.message}</p>
        )}
      </div>

      {/* Supervisor */}
      <div>
        <label htmlFor="ot-supervisor" className="block text-sm font-medium text-[#0B2545]">
          Immediate Supervisor
        </label>
        <select
          id="ot-supervisor"
          {...register('supervisorId')}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#C8A84B] focus:outline-none focus:ring-1 focus:ring-[#C8A84B]"
        >
          <option value="">Select supervisor</option>
          {supervisors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {errors.supervisorId && (
          <p className="mt-1 text-xs text-red-600">{errors.supervisorId.message}</p>
        )}
      </div>

      {/* Justification */}
      <div>
        <label htmlFor="ot-justification" className="block text-sm font-medium text-[#0B2545]">
          Justification
        </label>
        <textarea
          id="ot-justification"
          rows={4}
          {...register('justification')}
          placeholder="Describe the work to be performed during overtime and why it cannot be completed during regular hours..."
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#C8A84B] focus:outline-none focus:ring-1 focus:ring-[#C8A84B]"
        />
        {errors.justification && (
          <p className="mt-1 text-xs text-red-600">{errors.justification.message}</p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-[#FAF4E6] transition hover:bg-[#13315C] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Submitting…' : 'Submit Overtime Request'}
      </button>
    </form>
  );
}
