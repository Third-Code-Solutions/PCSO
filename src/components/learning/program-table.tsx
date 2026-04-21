import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export interface ProgramRow {
  id: string;
  code: string;
  title: string;
  lndType: string;
  mandatoryFlag: boolean;
  durationDays: number | null;
  participantCount: number | null;
}

interface Props {
  rows: ProgramRow[];
  emptyLabel?: string;
}

export function ProgramTable({
  rows,
  emptyLabel = "No training programs yet.",
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            {[
              "Code",
              "Title",
              "Type",
              "Duration",
              "Capacity",
              "Mandatory",
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
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
              <td className="px-4 py-3 font-medium">{p.title}</td>
              <td className="px-4 py-3 capitalize text-muted-foreground">
                {p.lndType}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {p.durationDays ? `${p.durationDays}d` : "—"}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {p.participantCount ?? "—"}
              </td>
              <td className="px-4 py-3">
                {p.mandatoryFlag ? (
                  <Badge variant="warning">Required</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Optional
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/learning/catalog/${p.id}`}
                  className="text-xs font-medium text-senate-navy hover:underline"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
