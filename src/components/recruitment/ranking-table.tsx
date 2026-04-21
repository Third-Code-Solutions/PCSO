"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PipelineStageBadge } from "./pipeline-stage-badge";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface RankingRow {
  applicationId: string;
  rank: number;
  applicantName: string;
  totalScore: number | null;
  status: string;
}

interface RankingTableProps {
  vacancyId: string;
  rows: RankingRow[];
  shortlistTop5: (
    vacancyId: string,
  ) => Promise<ActionResult<{ count: number }>>;
  recommendForBoard: (
    vacancyId: string,
    applicationIds: string[],
  ) => Promise<ActionResult<{ count: number }>>;
}

export function RankingTable({
  vacancyId,
  rows,
  shortlistTop5,
  recommendForBoard,
}: RankingTableProps) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, setPending] = React.useState<"top5" | "recommend" | null>(
    null,
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleTop5() {
    setPending("top5");
    try {
      const result = await shortlistTop5(vacancyId);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(`Shortlisted top ${result.data.count}.`);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to shortlist");
    } finally {
      setPending(null);
    }
  }

  async function handleRecommend() {
    if (selected.size === 0) {
      toast.error("Select at least one applicant.");
      return;
    }
    setPending("recommend");
    try {
      const result = await recommendForBoard(vacancyId, Array.from(selected));
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(`${result.data.count} recommended to board.`);
        setSelected(new Set());
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to recommend");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleTop5}
          disabled={pending !== null}
        >
          {pending === "top5" ? "Shortlisting…" : "Auto-Shortlist Top 5"}
        </Button>
        <Button
          type="button"
          onClick={handleRecommend}
          disabled={pending !== null}
        >
          {pending === "recommend"
            ? "Recommending…"
            : `Recommend to Board${selected.size > 0 ? ` (${selected.size})` : ""}`}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>Applicant</TableHead>
              <TableHead className="text-right">Total Score</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.applicationId}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(row.applicationId)}
                    onCheckedChange={() => toggle(row.applicationId)}
                    aria-label={`Select ${row.applicantName}`}
                  />
                </TableCell>
                <TableCell className="font-mono font-semibold">
                  #{row.rank}
                </TableCell>
                <TableCell className="font-medium">
                  {row.applicantName}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.totalScore !== null ? row.totalScore.toFixed(2) : "—"}
                </TableCell>
                <TableCell>
                  <PipelineStageBadge stage={row.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default RankingTable;
