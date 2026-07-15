"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  competencyDomainSchema,
  competencyLevelSchema,
} from "@/lib/validations/learning";
import { recordAssessment } from "@/lib/actions/ldm/competency";

const DOMAINS = competencyDomainSchema.options;
const LEVELS = competencyLevelSchema.options;

interface Props {
  employeeId: string;
  /** Current user's employee id — the assessor. */
  assessorEmployeeId: string | null;
  cycleYear: number;
  canManage: boolean;
}

/**
 * LDM-012 — competency assessment entry. Records a per-employee competency
 * score/level for a cycle; this is the upstream feeder that TNA gap analysis
 * consumes.
 */
export function RecordAssessmentDialog({
  employeeId,
  assessorEmployeeId,
  cycleYear,
  canManage,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [domain, setDomain] = React.useState<(typeof DOMAINS)[number]>("core");
  const [competencyCode, setCompetencyCode] = React.useState("");
  const [score, setScore] = React.useState("");
  const [level, setLevel] = React.useState<(typeof LEVELS)[number]>("novice");
  const [assessedAt, setAssessedAt] = React.useState(
    new Date().toISOString().slice(0, 10),
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!canManage || !assessorEmployeeId) return null;

  async function submit(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      const result = await recordAssessment({
        employeeId,
        domain,
        competencyCode: competencyCode.trim(),
        score: Number(score),
        level,
        assessedAt,
        cycleYear,
        assessorEmployeeId: assessorEmployeeId as string,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setCompetencyCode("");
      setScore("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Record Assessment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Competency Assessment</DialogTitle>
          <DialogDescription>
            Capture a competency score for cycle {cycleYear}. Assessments feed
            the Training Needs Analysis.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Domain</Label>
              <Select
                value={domain}
                onValueChange={(v) => setDomain(v as (typeof DOMAINS)[number])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOMAINS.map((d) => (
                    <SelectItem key={d} value={d} className="capitalize">
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Level</Label>
              <Select
                value={level}
                onValueChange={(v) => setLevel(v as (typeof LEVELS)[number])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l} className="capitalize">
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="competencyCode">Competency Code</Label>
            <Input
              id="competencyCode"
              value={competencyCode}
              onChange={(e) => setCompetencyCode(e.target.value)}
              placeholder="e.g. CORE-COMMUNICATION"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="score">Score (0–5)</Label>
              <Input
                id="score"
                type="number"
                min={0}
                max={5}
                step={0.01}
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="assessedAt">Assessed On</Label>
              <Input
                id="assessedAt"
                type="date"
                value={assessedAt}
                onChange={(e) => setAssessedAt(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              submitting || competencyCode.trim() === "" || score === ""
            }
          >
            {submitting ? "Saving…" : "Save Assessment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
