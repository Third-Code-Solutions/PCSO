import { cn } from "@/lib/utils/cn";

// ─── PipelineStageBadge ─────────────────────────────────────────────────────
//
// Renders a small coloured pill for any pipeline stage / status value used
// across MRFs, vacancies, applications, assessments, and appointments.

export type PipelineStage =
  // MRF
  | "draft"
  | "submitted"
  | "for_review"
  | "approved"
  | "returned"
  | "published"
  // Vacancy
  | "posted"
  | "closed"
  | "cancelled"
  // Application
  | "received"
  | "under_review"
  | "qualified"
  | "not_qualified"
  | "exam_scheduled"
  | "rated"
  | "shortlisted"
  | "recommended"
  | "appointed"
  | "rejected";

interface PipelineStageBadgeProps {
  stage: PipelineStage | string;
  className?: string;
}

const STAGE_STYLES: Record<string, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  submitted: {
    label: "Submitted",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  for_review: {
    label: "For Review",
    className: "bg-sky-100 text-sky-800 border-sky-200",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  returned: {
    label: "Returned",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  published: {
    label: "Published",
    className: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  posted: {
    label: "Posted",
    className: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  closed: {
    label: "Closed",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  received: {
    label: "Received",
    className: "bg-sky-100 text-sky-700 border-sky-200",
  },
  under_review: {
    label: "Under Review",
    className: "bg-sky-100 text-sky-800 border-sky-200",
  },
  qualified: {
    label: "Qualified",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  not_qualified: {
    label: "Not Qualified",
    className: "bg-red-100 text-red-700 border-red-200",
  },
  exam_scheduled: {
    label: "Exam Scheduled",
    className: "bg-violet-100 text-violet-800 border-violet-200",
  },
  rated: {
    label: "Rated",
    className: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
  },
  shortlisted: {
    label: "Shortlisted",
    className: "bg-amber-100 text-amber-900 border-amber-300",
  },
  recommended: {
    label: "Recommended",
    className: "bg-teal-100 text-teal-800 border-teal-200",
  },
  for_interview: {
    label: "Recommended to Board",
    className: "bg-teal-100 text-teal-800 border-teal-200",
  },
  results_released: {
    label: "Selected",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  not_selected: {
    label: "Not Selected",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
  appointed: {
    label: "Appointed",
    className: "bg-emerald-600 text-white border-emerald-700",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 border-red-200",
  },
};

export function PipelineStageBadge({
  stage,
  className,
}: PipelineStageBadgeProps) {
  const entry = STAGE_STYLES[stage] ?? {
    label: String(stage).replace(/_/g, " "),
    className: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
        entry.className,
        className,
      )}
    >
      {entry.label}
    </span>
  );
}

export default PipelineStageBadge;
