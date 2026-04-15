import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

// Status values used across all HRIS modules
export type StatusValue =
  // Employee / HR statuses
  | 'active'
  | 'inactive'
  | 'on_leave'
  | 'separated'
  | 'retired'
  // Workflow statuses
  | 'pending'
  | 'approved'
  | 'disapproved'
  | 'cancelled'
  | 'for_review'
  // Payroll / remittance statuses
  | 'paid'
  | 'unpaid'
  | 'partial'
  | 'processed'
  | 'draft'
  // Performance
  | 'submitted'
  | 'rated'
  | 'finalized'
  // Generic
  | 'open'
  | 'closed';

const statusConfig: Record<
  StatusValue,
  { label: string; className: string }
> = {
  // Employee
  active: { label: 'Active', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  inactive: { label: 'Inactive', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  on_leave: { label: 'On Leave', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  separated: { label: 'Separated', className: 'bg-red-100 text-red-700 border-red-200' },
  retired: { label: 'Retired', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  // Workflow
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  disapproved: { label: 'Disapproved', className: 'bg-red-100 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  for_review: { label: 'For Review', className: 'bg-sky-100 text-sky-700 border-sky-200' },
  // Payroll
  paid: { label: 'Paid', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  unpaid: { label: 'Unpaid', className: 'bg-red-100 text-red-700 border-red-200' },
  partial: { label: 'Partial', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  processed: { label: 'Processed', className: 'bg-teal-100 text-teal-800 border-teal-200' },
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  // Performance
  submitted: { label: 'Submitted', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  rated: { label: 'Rated', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  finalized: { label: 'Finalized', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  // Generic
  open: { label: 'Open', className: 'bg-sky-100 text-sky-700 border-sky-200' },
  closed: { label: 'Closed', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const statusBadgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
);

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  status: StatusValue;
}

function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <div
      className={cn(statusBadgeVariants(), config.className, className)}
      {...props}
    >
      {config.label}
    </div>
  );
}

export { StatusBadge };
