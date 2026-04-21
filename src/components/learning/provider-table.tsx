import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export interface ProviderRow {
  id: string;
  companyName: string;
  accreditationNumber: string | null;
  accreditationExpires: string | null;
  contactEmail: string;
  contactNumber: string;
  programsCount: number;
}

interface Props {
  rows: ProviderRow[];
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function ProviderTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        No providers registered yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            {["Provider", "Accreditation", "Contact", "Programs", ""].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((p) => {
            const d = daysUntil(p.accreditationExpires);
            const isExpiring = d !== null && d <= 60;
            return (
              <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium">{p.companyName}</td>
                <td className="px-4 py-3 text-xs">
                  {p.accreditationNumber ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono">{p.accreditationNumber}</span>
                      {p.accreditationExpires && (
                        <Badge variant={isExpiring ? "warning" : "muted"}>
                          {isExpiring
                            ? `Expires in ${d}d`
                            : `Valid until ${p.accreditationExpires}`}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  <div>{p.contactEmail}</div>
                  <div>{p.contactNumber}</div>
                </td>
                <td className="px-4 py-3 tabular-nums">{p.programsCount}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/learning/providers/${p.id}`}
                    className="text-xs font-medium text-senate-navy hover:underline"
                  >
                    View
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
