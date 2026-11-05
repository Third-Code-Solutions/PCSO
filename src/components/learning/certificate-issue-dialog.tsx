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
import { issueCertificate } from "@/lib/actions/ldm/certificates";

interface Props {
  participantId: string;
  participantName: string;
  disabled?: boolean;
}

/** Issuer is resolved server-side from the session (H-26). */
export function CertificateIssueDialog({
  participantId,
  participantName,
  disabled,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [score, setScore] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      const result = await issueCertificate({
        participantId,
        postAssessmentScore: score === "" ? undefined : Number(score),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
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
        <Button size="sm" variant="outline" disabled={disabled}>
          Issue Certificate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Training Certificate</DialogTitle>
          <DialogDescription>
            Issue a QR-verified Certificate of Training for {participantName}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="score">Post-Assessment Score (0–100)</Label>
            <Input
              id="score"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="Optional"
            />
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
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Issuing…" : "Issue Certificate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
