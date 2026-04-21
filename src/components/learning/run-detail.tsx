import { Badge } from "@/components/ui/badge";
import { CostBreakdownCard } from "./cost-breakdown-card";
import { ApprovalChain, type ApprovalStep } from "./approval-chain";

export interface RunDetailData {
  id: string;
  runNumber: string;
  programTitle: string;
  programCode: string;
  providerName: string;
  venue: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  facilitatorFees: string;
  venueCost: string;
  perParticipantCost: string;
  plannedHeadcount: number;
  actualHeadcount: number;
  totalBudget: string | null;
  approvals: ApprovalStep[];
}

interface Props {
  run: RunDetailData;
}

const STATUS_VARIANT: Record<
  string,
  "info" | "warning" | "success" | "muted" | "destructive"
> = {
  draft: "muted",
  for_approval: "warning",
  approved: "success",
  scheduled: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "destructive",
};

function fmtRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  return `${s.toLocaleString("en-PH", opts)} → ${e.toLocaleString("en-PH", opts)}`;
}

export function RunDetail({ run }: Props) {
  return (
    <section className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">
                {run.runNumber}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{run.programTitle}</h2>
              <p className="text-xs text-muted-foreground">{run.programCode}</p>
            </div>
            <Badge
              variant={STATUS_VARIANT[run.status] ?? "muted"}
              className="capitalize"
            >
              {run.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Provider</dt>
              <dd className="mt-0.5 font-medium">{run.providerName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Venue</dt>
              <dd className="mt-0.5">{run.venue}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Schedule</dt>
              <dd className="mt-0.5">
                {fmtRange(run.scheduledStart, run.scheduledEnd)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Headcount</dt>
              <dd className="mt-0.5 tabular-nums">
                {run.actualHeadcount} / {run.plannedHeadcount}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Approval Chain
          </h3>
          <ApprovalChain steps={run.approvals} />
        </div>
      </div>
      <CostBreakdownCard
        facilitatorFees={run.facilitatorFees}
        venueCost={run.venueCost}
        perParticipantCost={run.perParticipantCost}
        plannedHeadcount={run.plannedHeadcount}
        totalBudget={run.totalBudget}
      />
    </section>
  );
}
