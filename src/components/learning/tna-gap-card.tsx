import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface TnaGapRow {
  id: string;
  competencyCode: string;
  requiredLevel: string;
  currentLevel: string;
  gapLevels: number;
  suggestedProgramId: string | null;
  suggestedProgramTitle: string | null;
}

interface Props {
  gaps: TnaGapRow[];
  employeeLabel: string;
  onAssignHref?: (programId: string) => string;
}

function gapTone(n: number): "success" | "warning" | "destructive" | "muted" {
  if (n === 0) return "success";
  if (n === 1) return "muted";
  if (n === 2) return "warning";
  return "destructive";
}

export function TnaGapCard({ gaps, employeeLabel, onAssignHref }: Props) {
  if (gaps.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        No competency gaps identified for {employeeLabel}.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            {[
              "Competency",
              "Required",
              "Current",
              "Gap",
              "Suggested Program",
              "",
            ].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {gaps.map((g) => (
            <tr key={g.id} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3 font-mono text-xs">
                {g.competencyCode}
              </td>
              <td className="px-4 py-3 capitalize">{g.requiredLevel}</td>
              <td className="px-4 py-3 capitalize text-muted-foreground">
                {g.currentLevel}
              </td>
              <td className="px-4 py-3">
                <Badge variant={gapTone(g.gapLevels)}>
                  {g.gapLevels} level(s)
                </Badge>
              </td>
              <td className="px-4 py-3">
                {g.suggestedProgramId && g.suggestedProgramTitle ? (
                  <Link
                    href={`/learning/catalog/${g.suggestedProgramId}`}
                    className="text-xs font-medium text-senate-navy hover:underline"
                  >
                    {g.suggestedProgramTitle}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {g.suggestedProgramId && (
                  <Button size="sm" variant="outline" asChild>
                    <Link
                      href={
                        onAssignHref
                          ? onAssignHref(g.suggestedProgramId)
                          : `/learning/schedule/new?programId=${g.suggestedProgramId}`
                      }
                    >
                      Assign
                    </Link>
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
