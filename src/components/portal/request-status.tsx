/**
 * Shared presentation helpers for Employee Portal request workflows
 * (EPM-007 shift change, EPM-008 DTR correction).
 *
 * Both request tables share the `portal_request_status` enum and the
 * submit → supervisor endorse → HR apply pipeline, so the status badge and
 * the 3-step workflow timeline live here and are reused by the employee
 * pages, the supervisor queue, and the HR queues.
 */

import { format } from "date-fns";
import {
  CheckCircle2,
  Circle,
  Clock,
  MinusCircle,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { ShiftChangeRequest, WorkSchedule } from "@/lib/db/schema";

export type PortalRequestStatus = ShiftChangeRequest["status"];

// ─── Status badge ─────────────────────────────────────────────────────────────

export const REQUEST_STATUS_LABELS: Record<PortalRequestStatus, string> = {
  draft: "Draft",
  submitted: "Pending Supervisor",
  pending_supervisor: "Pending Supervisor",
  pending_hr: "Endorsed — Pending HR",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  processed: "Processed",
};

export const REQUEST_STATUS_VARIANTS: Record<
  PortalRequestStatus,
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "warning"
  | "info"
  | "muted"
  | "outline"
> = {
  draft: "secondary",
  submitted: "warning",
  pending_supervisor: "warning",
  pending_hr: "info",
  approved: "success",
  rejected: "destructive",
  cancelled: "muted",
  processed: "success",
};

export function RequestStatusBadge({
  status,
}: {
  status: PortalRequestStatus;
}) {
  return (
    <Badge variant={REQUEST_STATUS_VARIANTS[status] ?? "secondary"}>
      {REQUEST_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

// ─── DTR correction type labels ───────────────────────────────────────────────

export const CORRECTION_TYPE_LABELS: Record<string, string> = {
  ob: "Official Business",
  pass_out: "Pass Out",
  time_in_out: "Missed Time In/Out",
  special: "Other Special Case",
};

// ─── Formatting helpers ───────────────────────────────────────────────────────

/** "08:00:00" | "08:00" → "8:00 AM". Returns em-dash for null/blank. */
export function formatTimeOfDay(value: string | null | undefined): string {
  if (!value) return "—";
  const [h, m] = value.split(":");
  const hours = Number(h);
  const minutes = Number(m);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** Timestamp → "8:12 AM" (em-dash for null). */
export function formatTimestampTime(
  value: Date | string | null | undefined,
): string {
  if (!value) return "—";
  return format(new Date(value), "h:mm a");
}

/** "Flexi 7–4 (7:00 AM – 4:00 PM)" — compact schedule label for dropdowns/cards. */
export function scheduleLabel(
  schedule:
    | Pick<WorkSchedule, "name" | "timeIn" | "timeOut">
    | null
    | undefined,
): string {
  if (!schedule) return "—";
  return `${schedule.name} (${formatTimeOfDay(schedule.timeIn)} – ${formatTimeOfDay(schedule.timeOut)})`;
}

export function employeeName(
  employee:
    | { firstName: string; lastName: string; employeeNumber?: string | null }
    | null
    | undefined,
): string {
  if (!employee) return "—";
  const base = `${employee.lastName}, ${employee.firstName}`;
  return employee.employeeNumber
    ? `${base} (${employee.employeeNumber})`
    : base;
}

// ─── Workflow timeline ────────────────────────────────────────────────────────

export interface WorkflowStep {
  label: string;
  detail: string;
  state: "done" | "rejected" | "pending" | "muted";
}

interface WorkflowRequestLike {
  createdAt: Date | string;
  status: PortalRequestStatus;
  supervisorApprovedAt: Date | string | null;
  hrApprovedAt: Date | string | null;
  supervisor?: { firstName: string; lastName: string } | null;
  hrReviewer?: { firstName: string; lastName: string } | null;
}

function formatStamp(value: Date | string): string {
  return format(new Date(value), "MMM d, yyyy h:mm a");
}

/**
 * Derives the 3-step (Submitted → Supervisor → HR) timeline for a portal
 * request row. Works for both shift-change and DTR-correction requests.
 */
export function buildWorkflowSteps(req: WorkflowRequestLike): WorkflowStep[] {
  const steps: WorkflowStep[] = [
    {
      label: "Submitted",
      detail: formatStamp(req.createdAt),
      state: "done",
    },
  ];

  // Step 2 — supervisor endorsement
  if (req.supervisorApprovedAt) {
    const by = req.supervisor
      ? ` by ${req.supervisor.firstName} ${req.supervisor.lastName}`
      : "";
    steps.push({
      label: "Supervisor Endorsement",
      detail: `Endorsed ${formatStamp(req.supervisorApprovedAt)}${by}`,
      state: "done",
    });
  } else if (req.status === "rejected") {
    steps.push({
      label: "Supervisor Endorsement",
      detail: "Rejected by supervisor",
      state: "rejected",
    });
  } else if (req.status === "cancelled") {
    steps.push({
      label: "Supervisor Endorsement",
      detail: "Cancelled before review",
      state: "muted",
    });
  } else {
    steps.push({
      label: "Supervisor Endorsement",
      detail: "Awaiting supervisor action",
      state: "pending",
    });
  }

  // Step 3 — HR decision
  if (req.hrApprovedAt) {
    const by = req.hrReviewer
      ? ` by ${req.hrReviewer.firstName} ${req.hrReviewer.lastName}`
      : "";
    steps.push({
      label: "HR Decision",
      detail: `Approved ${formatStamp(req.hrApprovedAt)}${by}`,
      state: "done",
    });
  } else if (req.status === "rejected" && req.supervisorApprovedAt) {
    steps.push({
      label: "HR Decision",
      detail: "Rejected by HR",
      state: "rejected",
    });
  } else if (req.status === "pending_hr") {
    steps.push({
      label: "HR Decision",
      detail: "Awaiting HR action",
      state: "pending",
    });
  } else {
    steps.push({ label: "HR Decision", detail: "—", state: "muted" });
  }

  return steps;
}

const STEP_ICONS = {
  done: CheckCircle2,
  rejected: XCircle,
  pending: Clock,
  muted: MinusCircle,
} as const;

const STEP_ICON_CLASSES = {
  done: "text-emerald-600",
  rejected: "text-rose-600",
  pending: "text-amber-600",
  muted: "text-muted-foreground/40",
} as const;

/** Compact vertical timeline of the request workflow. */
export function WorkflowTimeline({
  request,
}: {
  request: WorkflowRequestLike;
}) {
  const steps = buildWorkflowSteps(request);

  return (
    <ol className="space-y-1.5" aria-label="Request status timeline">
      {steps.map((step, index) => {
        const Icon = STEP_ICONS[step.state] ?? Circle;
        return (
          <li key={index} className="flex items-start gap-2 text-xs">
            <Icon
              className={cn(
                "mt-0.5 h-3.5 w-3.5 shrink-0",
                STEP_ICON_CLASSES[step.state],
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <span className="font-medium text-foreground">{step.label}</span>
              <span className="text-muted-foreground"> · {step.detail}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
