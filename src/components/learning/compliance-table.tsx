import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export interface ComplianceRow {
  programId: string;
  programCode: string;
  programTitle: string;
  targetCount: number;
  compliantCount: number;
}

interface Props {
  rows: ComplianceRow[];
}

function pct(c: number, t: number): number {
  if (t === 0) return 0;
  return Math.round((c / t) * 100);
}

export function ComplianceTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        No mandatory programs configured.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            {["Program", "Compliance", "% Compliant", ""].map((h) => (
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
          {rows.map((r) => {
            const p = pct(r.compliantCount, r.targetCount);
            const tone =
              p >= 90
                ? "bg-emerald-500"
                : p >= 70
                  ? "bg-amber-500"
                  : "bg-red-500";
            const nonCompliant = r.targetCount - r.compliantCount;
            return (
              <tr
                key={r.programId}
                className="hover:bg-muted/20 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{r.programTitle}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {r.programCode}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">
                      {r.compliantCount}/{r.targetCount}
                    </span>
                    {nonCompliant > 0 && (
                      <Badge variant="destructive">
                        {nonCompliant} non-compliant
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3" style={{ width: "240px" }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={p}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={`h-2 ${tone} transition-[width] duration-500`}
                        style={{ width: `${p}%` }}
                      />
                    </div>
                    <span className="w-10 text-right tabular-nums text-xs font-medium">
                      {p}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/learning/mandatory?programId=${r.programId}`}
                    className="text-xs font-medium text-pcso-navy hover:underline"
                  >
                    View list
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
