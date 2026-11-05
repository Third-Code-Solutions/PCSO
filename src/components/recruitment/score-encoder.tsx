"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RecordScoreInput } from "@/lib/actions/rpm/selection";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type Dimension = RecordScoreInput["dimension"];

const DIMENSION_LABELS: Record<Dimension, string> = {
  written_exam: "Written Exam",
  interview: "Interview",
  physical_exam: "Physical Exam",
  other: "Other",
};

/** Dimension config stored on the assessment (weight and max are fixed there). */
export interface ScoreDimension {
  key: Dimension;
  label?: string;
  maxScore: number;
}

export interface QualifiedApplicantRow {
  applicationId: string;
  applicantName: string;
}

interface ScoreEncoderProps {
  assessmentId: string;
  dimensions: ScoreDimension[];
  applicants: QualifiedApplicantRow[];
  recordScoreAction: (
    input: RecordScoreInput,
  ) => Promise<ActionResult<{ completed: boolean }>>;
}

interface RowState {
  dimension: Dimension;
  score: string;
  pending: boolean;
}

export function ScoreEncoder({
  assessmentId,
  dimensions,
  applicants,
  recordScoreAction,
}: ScoreEncoderProps) {
  const router = useRouter();
  const firstDimension: Dimension = dimensions[0]?.key ?? "written_exam";
  const [rowState, setRowState] = React.useState<Record<string, RowState>>(
    () => {
      const init: Record<string, RowState> = {};
      for (const a of applicants) {
        init[a.applicationId] = {
          dimension: firstDimension,
          score: "",
          pending: false,
        };
      }
      return init;
    },
  );

  function updateRow(id: string, patch: Partial<RowState>) {
    setRowState((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, ...patch } };
    });
  }

  async function saveRow(applicationId: string) {
    const row = rowState[applicationId];
    if (!row) return;
    if (!row.score.trim()) {
      toast.error("Enter a score.");
      return;
    }
    updateRow(applicationId, { pending: true });
    try {
      const result = await recordScoreAction({
        assessmentId,
        applicationId,
        dimension: row.dimension,
        score: row.score.trim(),
      });
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success(
          result.data.completed
            ? "Score recorded. All scores are in; ranking updated."
            : "Score recorded.",
        );
        updateRow(applicationId, { score: "" });
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save score");
    } finally {
      updateRow(applicationId, { pending: false });
    }
  }

  if (applicants.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        No qualified applicants to score yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Applicant</TableHead>
            <TableHead>Dimension</TableHead>
            <TableHead className="w-36">Score</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {applicants.map((a) => {
            const row: RowState = rowState[a.applicationId] ?? {
              dimension: firstDimension,
              score: "",
              pending: false,
            };
            const maxScore = dimensions.find(
              (d) => d.key === row.dimension,
            )?.maxScore;
            return (
              <TableRow key={a.applicationId}>
                <TableCell className="font-medium">{a.applicantName}</TableCell>
                <TableCell>
                  <Select
                    value={row.dimension}
                    onValueChange={(v) =>
                      updateRow(a.applicationId, { dimension: v as Dimension })
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dimensions.map((d) => (
                        <SelectItem key={d.key} value={d.key}>
                          {d.label ?? DIMENSION_LABELS[d.key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Input
                      inputMode="decimal"
                      className="font-mono"
                      value={row.score}
                      aria-label={`Score for ${a.applicantName}`}
                      onChange={(e) =>
                        updateRow(a.applicationId, { score: e.target.value })
                      }
                    />
                    {maxScore !== undefined ? (
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        / {maxScore}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => saveRow(a.applicationId)}
                    disabled={row.pending}
                  >
                    {row.pending ? "Saving…" : "Save"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default ScoreEncoder;
