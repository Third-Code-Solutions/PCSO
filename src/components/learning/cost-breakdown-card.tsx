interface CostBreakdownCardProps {
  facilitatorFees: string | number;
  venueCost: string | number;
  perParticipantCost: string | number;
  plannedHeadcount: number;
  totalBudget?: string | number | null;
}

function php(n: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(n);
}

function toNum(v: string | number): number {
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function CostBreakdownCard({
  facilitatorFees,
  venueCost,
  perParticipantCost,
  plannedHeadcount,
  totalBudget,
}: CostBreakdownCardProps) {
  const fac = toNum(facilitatorFees);
  const ven = toNum(venueCost);
  const perHead = toNum(perParticipantCost);
  const computed = fac + ven + perHead * plannedHeadcount;
  const total = totalBudget != null ? toNum(totalBudget) : computed;

  const rows: Array<{ label: string; value: string; sub?: string }> = [
    { label: "Facilitator fees", value: php(fac) },
    { label: "Venue cost", value: php(ven) },
    {
      label: "Per-participant × headcount",
      value: php(perHead * plannedHeadcount),
      sub: `${php(perHead)} × ${plannedHeadcount}`,
    },
  ];

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold">Cost Breakdown</h3>
      <dl className="mt-3 space-y-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-baseline justify-between border-b border-dashed pb-2 last:border-0 last:pb-0"
          >
            <dt className="text-xs text-muted-foreground">
              {r.label}
              {r.sub && (
                <span className="ml-1 font-mono text-[10px] text-muted-foreground/80">
                  ({r.sub})
                </span>
              )}
            </dt>
            <dd className="text-sm font-medium tabular-nums">{r.value}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between pt-2">
          <dt className="text-sm font-semibold">Total budget</dt>
          <dd className="text-xl font-bold tabular-nums text-senate-navy">
            {php(total)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
