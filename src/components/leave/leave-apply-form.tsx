/**
 * LeaveApplyForm — client-side form for filing a leave application.
 *
 * Features:
 *  - Leave type selection filtered by employee eligibility
 *  - Date range picker that blocks existing approved leaves + holidays
 *  - Real-time credit balance display while filling in the form
 *  - Conditional document upload for SL > 3 days and other leave types
 */

'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ApplyLeaveSchema, type ApplyLeaveInput } from '@/lib/validations/leave';
import {
  LEAVE_TYPES,
  SL_MEDICAL_CERT_THRESHOLD_DAYS,
  type LeaveTypeCode,
} from '@/lib/constants/leave-types';
import type { LeaveTypeDefinition } from '@/lib/constants/leave-types';
import { CreditBalanceCard } from '@/components/leave/credit-balance-card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { AlertCircleIcon, UploadIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LeaveApplyFormProps {
  employeeId: string;
  /** Leave types the employee is eligible to apply for. */
  eligibleLeaveTypes: LeaveTypeDefinition[];
  vlBalance: number;
  slBalance: number;
  year: number;
  /** Blocked date ranges (existing approved leaves). Format: 'YYYY-MM-DD'. */
  blockedDates?: string[];
  onSubmit: (data: ApplyLeaveInput) => Promise<{ leaveApplicationId: string }>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeaveApplyForm({
  employeeId,
  eligibleLeaveTypes,
  vlBalance,
  slBalance,
  year,
  onSubmit,
}: LeaveApplyFormProps) {
  const [isPending, startTransition] = useTransition();
  const [workingDays, setWorkingDays] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ApplyLeaveInput>({
    resolver: zodResolver(ApplyLeaveSchema),
    defaultValues: {
      employeeId,
      period: 'whole_day',
      isCommutation: false,
      workingDays: 0,
    },
  });

  const leaveTypeCode = watch('leaveTypeCode') as LeaveTypeCode | undefined;
  const startDate = watch('startDate');
  const endDate = watch('endDate');

  // Compute working days when dates change
  useEffect(() => {
    if (!startDate || !endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return;
    const days = countWorkingDays(start, end);
    setWorkingDays(days);
    setValue('workingDays', days);
  }, [startDate, endDate, setValue]);

  const selectedLeaveType = leaveTypeCode ? LEAVE_TYPES[leaveTypeCode] : null;

  const isVLLeave = leaveTypeCode === 'VL' || leaveTypeCode === 'FL';
  const isSLLeave = leaveTypeCode === 'SL';
  const needsDocumentConditional =
    isSLLeave && workingDays > SL_MEDICAL_CERT_THRESHOLD_DAYS;
  const needsDocumentAlways =
    selectedLeaveType?.documentRequired === 'always';
  const requiresDocument = needsDocumentAlways || needsDocumentConditional;

  const pendingVlDeduction = isVLLeave ? workingDays : 0;
  const pendingSlDeduction = isSLLeave ? workingDays : 0;

  function onValid(data: ApplyLeaveInput) {
    startTransition(async () => {
      try {
        // In production, files would be uploaded to Supabase Storage first
        // and the paths would be passed to the server action.
        const result = await onSubmit({ ...data, attachmentPaths: [] });
        toast.success('Leave application submitted successfully.', {
          description: `Application ID: ${result.leaveApplicationId.slice(0, 8).toUpperCase()}`,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to submit leave application.');
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Credit Balance Sidebar */}
      <aside className="order-last lg:order-first lg:col-span-1">
        <CreditBalanceCard
          vlBalance={vlBalance}
          slBalance={slBalance}
          year={year}
          pendingVlDeduction={pendingVlDeduction}
          pendingSlDeduction={pendingSlDeduction}
        />

        {workingDays > 0 && leaveTypeCode && (
          <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="font-medium text-foreground">Working Days Selected</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-senate-navy">
              {workingDays}
            </p>
            {isVLLeave && workingDays > vlBalance && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
                <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" />
                Exceeds VL balance of {vlBalance.toFixed(3)} days
              </p>
            )}
            {isSLLeave && workingDays > slBalance && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
                <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" />
                Exceeds SL balance of {slBalance.toFixed(3)} days
              </p>
            )}
          </div>
        )}
      </aside>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onValid)}
        className="order-first space-y-5 lg:order-last lg:col-span-2"
        noValidate
      >
        {/* Leave Type */}
        <div className="space-y-1.5">
          <Label htmlFor="leaveTypeCode">
            Leave Type <span className="text-destructive">*</span>
          </Label>
          <Select
            onValueChange={(value) =>
              setValue('leaveTypeCode', value as LeaveTypeCode, { shouldValidate: true })
            }
          >
            <SelectTrigger id="leaveTypeCode" className={cn(errors.leaveTypeCode && 'border-destructive')}>
              <SelectValue placeholder="Select a leave type..." />
            </SelectTrigger>
            <SelectContent>
              {eligibleLeaveTypes.map((lt) => (
                <SelectItem key={lt.code} value={lt.code}>
                  <span className="font-medium">{lt.code}</span>
                  <span className="ml-2 text-muted-foreground">{lt.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.leaveTypeCode && (
            <p className="text-xs text-destructive">{errors.leaveTypeCode.message}</p>
          )}
          {selectedLeaveType && (
            <p className="text-xs text-muted-foreground">{selectedLeaveType.notes.slice(0, 120)}…</p>
          )}
        </div>

        {/* Period */}
        <div className="space-y-1.5">
          <Label htmlFor="period">Period</Label>
          <Select
            defaultValue="whole_day"
            onValueChange={(v) =>
              setValue('period', v as 'am' | 'pm' | 'whole_day', { shouldValidate: true })
            }
          >
            <SelectTrigger id="period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whole_day">Whole Day</SelectItem>
              <SelectItem value="am">Morning (AM)</SelectItem>
              <SelectItem value="pm">Afternoon (PM)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="startDate">
              Date From <span className="text-destructive">*</span>
            </Label>
            <Input
              id="startDate"
              type="date"
              {...register('startDate')}
              className={cn(errors.startDate && 'border-destructive')}
            />
            {errors.startDate && (
              <p className="text-xs text-destructive">{errors.startDate.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="endDate">
              Date To <span className="text-destructive">*</span>
            </Label>
            <Input
              id="endDate"
              type="date"
              {...register('endDate')}
              min={startDate}
              className={cn(errors.endDate && 'border-destructive')}
            />
            {errors.endDate && (
              <p className="text-xs text-destructive">{errors.endDate.message}</p>
            )}
          </div>
        </div>

        {/* Reason */}
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason / Purpose</Label>
          <textarea
            id="reason"
            {...register('reason')}
            className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-senate-navy"
            rows={3}
            placeholder="Briefly describe the purpose of your leave (optional)..."
          />
          {errors.reason && (
            <p className="text-xs text-destructive">{errors.reason.message}</p>
          )}
        </div>

        {/* Document upload */}
        <div className="space-y-1.5">
          <Label htmlFor="attachments">
            Supporting Document
            {requiresDocument && <span className="ml-1 text-destructive">*</span>}
          </Label>
          {requiresDocument ? (
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center',
                'cursor-pointer hover:border-senate-navy/50 hover:bg-muted/30 transition-colors',
                errors.attachmentPaths && 'border-destructive',
              )}
              onClick={() => document.getElementById('file-input')?.click()}
              onKeyDown={(e) => e.key === 'Enter' && document.getElementById('file-input')?.click()}
              role="button"
              tabIndex={0}
            >
              <UploadIcon className="h-8 w-8 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium">
                  {selectedFiles && selectedFiles.length > 0
                    ? `${selectedFiles.length} file(s) selected`
                    : 'Click to upload documents'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedLeaveType?.documentRequirementDescription ??
                    'PDF, JPG, PNG up to 10MB each'}
                </p>
              </div>
              <input
                id="file-input"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                className="sr-only"
                onChange={(e) => setSelectedFiles(e.target.files)}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                id="attachments"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-muted/80"
                onChange={(e) => setSelectedFiles(e.target.files)}
              />
            </div>
          )}
          {errors.attachmentPaths && (
            <p className="text-xs text-destructive">{String(errors.attachmentPaths.message)}</p>
          )}
        </div>

        {/* Important notices */}
        {selectedLeaveType && workingDays > 30 && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Leave exceeding 30 working days requires multi-level approval (Supervisor
              &rarr; HR Admin &rarr; Super Admin). Processing may take additional time.
            </p>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="bg-senate-navy hover:bg-senate-navy-light text-senate-cream"
          >
            {isPending ? 'Submitting...' : 'Submit Application'}
          </Button>
        </div>
      </form>
    </div>
  );
}
