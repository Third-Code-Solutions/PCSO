import { cn } from "@/lib/utils/cn";

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "shortlisted"
  | "rejected"
  | "withdrawn"
  | "selected"
  | "offer_extended"
  | "offer_accepted"
  | "offer_declined"
  | "hired";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-[#faf6ec] text-[#8a6d2c] border-[#e7ddc7]",
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  under_review: "bg-amber-50 text-amber-700 border-amber-200",
  shortlisted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  selected: "bg-emerald-50 text-emerald-700 border-emerald-200",
  offer_extended: "bg-emerald-100 text-emerald-800 border-emerald-300",
  offer_accepted: "bg-emerald-100 text-emerald-800 border-emerald-300",
  offer_declined: "bg-rose-50 text-rose-700 border-rose-200",
  hired: "bg-emerald-200 text-emerald-900 border-emerald-400",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  withdrawn: "bg-zinc-100 text-zinc-700 border-zinc-300",
  // applications.status values (RPM-010)
  qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  not_qualified: "bg-rose-50 text-rose-700 border-rose-200",
  for_exam: "bg-blue-50 text-blue-700 border-blue-200",
  for_interview: "bg-blue-50 text-blue-700 border-blue-200",
  results_released: "bg-emerald-100 text-emerald-800 border-emerald-300",
  not_selected: "bg-zinc-100 text-zinc-700 border-zinc-300",
  appointed: "bg-emerald-200 text-emerald-900 border-emerald-400",
};

// Statuses whose raw name would mislead the applicant.
const STATUS_LABELS: Record<string, string> = {
  results_released: "selected",
  not_selected: "not selected",
};

function humanize(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        style,
        className,
      )}
    >
      {humanize(status)}
    </span>
  );
}
