"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

// The match score returned by the server action may be `string` (preserving
// numeric precision) or `number`. We don't actually read it here — we just
// care whether the call succeeded — so keep the return shape loose.
interface QualifyButtonProps {
  applicationId: string;
  decision: "qualified" | "not_qualified";
  action: (
    id: string,
    decision: "qualified" | "not_qualified",
    reason?: string,
  ) => Promise<
    ActionResult<{ id: string; matchScore: number | string | null }>
  >;
  requireReason?: boolean;
  label?: string;
  variant?: "default" | "outline" | "destructive";
}

export function QualifyButton({
  applicationId,
  decision,
  action,
  requireReason = false,
  label,
  variant = "default",
}: QualifyButtonProps) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [showReason, setShowReason] = React.useState(false);

  const buttonLabel =
    label ?? (decision === "qualified" ? "Mark Qualified" : "Disqualify");

  async function submit() {
    if (requireReason && !reason.trim()) {
      setShowReason(true);
      toast.error("Reason required.");
      return;
    }
    setPending(true);
    try {
      const result = await action(applicationId, decision, reason || undefined);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success(
          decision === "qualified"
            ? "Applicant qualified."
            : "Applicant disqualified.",
        );
        setReason("");
        setShowReason(false);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPending(false);
    }
  }

  if (requireReason && showReason) {
    return (
      <div className="w-full space-y-2">
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Enter disqualification reason"
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowReason(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={variant}
            size="sm"
            onClick={submit}
            disabled={pending}
          >
            {pending ? "Submitting…" : "Confirm"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={() => (requireReason ? setShowReason(true) : submit())}
      disabled={pending}
    >
      {pending ? "Submitting…" : buttonLabel}
    </Button>
  );
}

export default QualifyButton;
