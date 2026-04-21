import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WellnessAggregateCardProps {
  title: string;
  aggregate: Readonly<Record<string, number>>;
  emptyMessage?: string;
}

export function WellnessAggregateCard({
  title,
  aggregate,
  emptyMessage = "No data for this period.",
}: WellnessAggregateCardProps) {
  const entries = Object.entries(aggregate)
    .map(([key, value]) => ({ key, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value);

  const max = entries.length > 0 ? (entries[0]?.value ?? 0) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => {
              const pct = max > 0 ? Math.round((entry.value / max) * 100) : 0;
              return (
                <li key={entry.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate pr-2 text-foreground">
                      {entry.key}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {entry.value.toLocaleString()}
                    </span>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
