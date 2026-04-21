import { CheckCircle2Icon, CircleIcon, XCircleIcon } from "lucide-react";

export interface ApprovalStep {
  id: string;
  sequenceOrder: number;
  approverRole: string;
  approverName: string;
  decision: "pending" | "approved" | "rejected";
  decidedAt: string | null;
  comments: string | null;
}

interface Props {
  steps: ApprovalStep[];
}

export function ApprovalChain({ steps }: Props) {
  if (steps.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No approval chain defined yet. Submit the run for approval to assign
        approvers.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {[...steps]
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
        .map((s) => {
          const Icon =
            s.decision === "approved"
              ? CheckCircle2Icon
              : s.decision === "rejected"
                ? XCircleIcon
                : CircleIcon;
          const tone =
            s.decision === "approved"
              ? "text-emerald-600"
              : s.decision === "rejected"
                ? "text-red-600"
                : "text-muted-foreground";
          return (
            <li
              key={s.id}
              className="flex gap-3 rounded-lg border bg-card p-3 shadow-sm"
            >
              <Icon
                className={`mt-0.5 h-5 w-5 flex-shrink-0 ${tone}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {s.sequenceOrder}. {s.approverName}
                  </p>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {s.approverRole}
                  </span>
                </div>
                <p className={`mt-0.5 text-xs capitalize ${tone}`}>
                  {s.decision}
                  {s.decidedAt && (
                    <span className="ml-1 text-muted-foreground">
                      • {new Date(s.decidedAt).toLocaleDateString("en-PH")}
                    </span>
                  )}
                </p>
                {s.comments && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.comments}
                  </p>
                )}
              </div>
            </li>
          );
        })}
    </ol>
  );
}
