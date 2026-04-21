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
import type { AssessmentScoreInput } from "@/lib/validations/recruitment";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type Dimension = AssessmentScoreInput["dimension"];

const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: "written_exam", label: "Written Exam" },
  { value: "interview", label: "Interview" },
  { value: "physical_exam", label: "Physical Exam" },
  { value: "other", label: "Other" },
];

export interface QualifiedApplicantRow {
  applicationId: string;
  applicantName: string;
  currentScore: number | null;
}

interface ScoreEncoderProps {
  assessmentId: string;
  raterEmployeeId: string;
  applicants: QualifiedApplicantRow[];
  recordScoreAction: (
    input: AssessmentScoreInput,
  ) => Promise<ActionResult<{ applicationId: string }>>;
}

interface RowState {
  dimension: Dimension;
  score: string;
  maxScore: string;
  weight: string;
  pending: boolean;
}

export function ScoreEncoder({
  assessmentId,
  raterEmployeeId,
  applicants,
  recordScoreAction,
}: ScoreEncoderProps) {
  const router = useRouter();
  const [rowState, setRowState] = React.useState<Record<string, RowState>>(
    () => {
      const init: Record<string, RowState> = {};
      for (const a of applicants) {
        init[a.applicationId] = {
          dimension: "written_exam",
          score: "",
          maxScore: "100.00",
          weight: "1.00",
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
    if (!row.score || !row.maxScore || !row.weight) {
      toast.error("Score, max score, and weight are required.");
      return;
    }
    updateRow(applicationId, { pending: true });
    try {
      const result = await recordScoreAction({
        assessmentId,
        applicationId,
        dimension: row.dimension,
        score: row.score,
        maxScore: row.maxScore,
        weight: row.weight,
        raterEmployeeId,
      });
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success("Score recorded.");
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
            <TableHead className="w-28">Score</TableHead>
            <TableHead className="w-28">Max</TableHead>
            <TableHead className="w-24">Weight</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {applicants.map((a) => {
            const row: RowState = rowState[a.applicationId] ?? {
              dimension: "written_exam",
              score: "",
              maxScore: "100.00",
              weight: "1.00",
              pending: false,
            };
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
                      {DIMENSIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    inputMode="decimal"
                    className="font-mono"
                    value={row.score}
                    onChange={(e) =>
                      updateRow(a.applicationId, { score: e.target.value })
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    inputMode="decimal"
                    className="font-mono"
                    value={row.maxScore}
                    onChange={(e) =>
                      updateRow(a.applicationId, { maxScore: e.target.value })
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    inputMode="decimal"
                    className="font-mono"
                    value={row.weight}
                    onChange={(e) =>
                      updateRow(a.applicationId, { weight: e.target.value })
                    }
                  />
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
