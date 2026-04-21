"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
// Upstream Agent 09 — may not exist yet.
import { nominateParticipants } from "@/lib/actions/ldm/scheduling";

export interface NominatableEmployee {
  id: string;
  employeeNo: string;
  fullName: string;
  officeName: string | null;
}

interface Props {
  runId: string;
  candidates: NominatableEmployee[];
  alreadyNominated: Set<string>;
}

export function ParticipantNominator({
  runId,
  candidates,
  alreadyNominated,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.employeeNo.toLowerCase().includes(q) ||
        (c.officeName ?? "").toLowerCase().includes(q),
    );
  }, [candidates, query]);

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      const result = await nominateParticipants({
        runId,
        employeeIds: Array.from(selected),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search employees by name, number, or office…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <Button
          size="sm"
          disabled={selected.size === 0 || submitting}
          onClick={submit}
        >
          {submitting
            ? "Nominating…"
            : `Nominate ${selected.size} participant${selected.size === 1 ? "" : "s"}`}
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="max-h-96 overflow-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
            <tr>
              {["", "Employee", "No.", "Office"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.slice(0, 200).map((e) => {
              const already = alreadyNominated.has(e.id);
              return (
                <tr
                  key={e.id}
                  className={already ? "opacity-50" : "hover:bg-muted/20"}
                >
                  <td className="px-4 py-2">
                    <Checkbox
                      checked={selected.has(e.id)}
                      disabled={already}
                      onCheckedChange={() => toggle(e.id)}
                      aria-label={`Select ${e.fullName}`}
                    />
                  </td>
                  <td className="px-4 py-2">
                    {e.fullName}
                    {already && (
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        (already nominated)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {e.employeeNo}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {e.officeName ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
