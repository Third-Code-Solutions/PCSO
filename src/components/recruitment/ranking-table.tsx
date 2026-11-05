"use client";

import * as React from "react";
import Link from "next/link";
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
import { downloadBase64Pdf } from "./download";
import { PipelineStageBadge } from "./pipeline-stage-badge";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type PdfResult = { pdfBase64: string; serial: string; filename: string };

/** One row of `listRanked` (assessment-rated applicants only). */
export interface RankingRow {
  id: string;
  rank: number;
  applicantName: string;
  score: number;
  status: string;
}

interface RankingTableProps {
  vacancyId: string;
  rows: RankingRow[];
  canManage: boolean;
  shortlistTop5: (
    vacancyId: string,
  ) => Promise<ActionResult<PdfResult & { shortlisted: string[] }>>;
  recommendForBoard: (
    vacancyId: string,
    applicationIds: string[],
  ) => Promise<ActionResult<PdfResult>>;
  releaseResults: (
    vacancyId: string,
    selectedApplicationIds: string[],
  ) => Promise<ActionResult<{ selected: number; notSelected: number }>>;
}

// Rows a checkbox can act on: shortlisted → recommend; recommended → release.
const SELECTABLE = new Set(["shortlisted", "for_interview"]);

export function RankingTable({
  vacancyId,
  rows,
  canManage,
  shortlistTop5,
  recommendForBoard,
  releaseResults,
}: RankingTableProps) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, setPending] = React.useState<
    "top5" | "recommend" | "release" | null
  >(null);

  const pickedWith = (status: string) =>
    rows
      .filter((r) => selected.has(r.id) && r.status === status)
      .map((r) => r.id);
  const toRecommend = pickedWith("shortlisted");
  const toRelease = pickedWith("for_interview");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run<T>(
    kind: "top5" | "recommend" | "release",
    call: () => Promise<ActionResult<T>>,
    onSuccess: (data: T) => void,
  ) {
    setPending(kind);
    try {
      const result = await call();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onSuccess(result.data);
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPending(null);
    }
  }

  function handleTop5() {
    void run(
      "top5",
      () => shortlistTop5(vacancyId),
      (data) => {
        downloadBase64Pdf(data.pdfBase64, data.filename);
        toast.success(
          `Shortlisted top ${data.shortlisted.length} (${data.serial}).`,
        );
      },
    );
  }

  function handleRecommend() {
    void run(
      "recommend",
      () => recommendForBoard(vacancyId, toRecommend),
      (data) => {
        downloadBase64Pdf(data.pdfBase64, data.filename);
        toast.success(
          `${toRecommend.length} recommended to the Board (${data.serial}).`,
        );
      },
    );
  }

  function handleRelease() {
    const ok = window.confirm(
      `Release final results? The ${toRelease.length} selected applicant(s) become eligible for appointment; every other applicant still in the running is marked Not Selected and emailed. This cannot be undone.`,
    );
    if (!ok) return;
    void run(
      "release",
      () => releaseResults(vacancyId, toRelease),
      (data) => {
        toast.success(
          `Results released: ${data.selected} selected, ${data.notSelected} not selected.`,
        );
      },
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        {canManage ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleTop5}
              disabled={pending !== null}
            >
              {pending === "top5" ? "Shortlisting…" : "Auto-Shortlist Top 5"}
            </Button>
          </div>
        ) : null}
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          No ranking yet. Ranks appear once every qualified applicant has a
          score for every assessment dimension.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canManage ? (
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
            variant="outline"
            onClick={handleRecommend}
            disabled={pending !== null || toRecommend.length === 0}
          >
            {pending === "recommend"
              ? "Recommending…"
              : `Recommend to Board${toRecommend.length > 0 ? ` (${toRecommend.length})` : ""}`}
          </Button>
          <Button
            type="button"
            onClick={handleRelease}
            disabled={pending !== null || toRelease.length === 0}
          >
            {pending === "release"
              ? "Releasing…"
              : `Release Results${toRelease.length > 0 ? ` (${toRelease.length} selected)` : ""}`}
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {canManage ? <TableHead className="w-10" /> : null}
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>Applicant</TableHead>
              <TableHead className="text-right">Total Score</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead className="w-40" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {canManage ? (
                  <TableCell>
                    {SELECTABLE.has(row.status) ? (
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={() => toggle(row.id)}
                        aria-label={`Select ${row.applicantName}`}
                      />
                    ) : null}
                  </TableCell>
                ) : null}
                <TableCell className="font-mono font-semibold">
                  #{row.rank}
                </TableCell>
                <TableCell className="font-medium">
                  {row.applicantName}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.score.toFixed(2)}
                </TableCell>
                <TableCell>
                  <PipelineStageBadge stage={row.status} />
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
                    {row.status === "results_released" ? (
                      <Link
                        href={`/recruitment/appointments/new?applicationId=${row.id}`}
                        className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                      >
                        Create appointment
                      </Link>
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default RankingTable;
