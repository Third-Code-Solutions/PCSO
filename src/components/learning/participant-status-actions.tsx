"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  confirmParticipant,
  markParticipantCompleted,
} from "@/lib/actions/ldm/scheduling";

interface Props {
  participantId: string;
  status: string;
}

/**
 * LDM-006/010 — participant progression controls.
 *
 * Moves a participant along nominated → confirmed → completed so that
 * certificate issuance (which requires `completed`) becomes reachable.
 */
export function ParticipantStatusActions({ participantId, status }: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run<T>(
    action: () => Promise<{ data: T } | { error: string }>,
  ): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const result = await action();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setPending(false);
    }
  }

  let control: React.ReactNode = null;
  if (status === "nominated") {
    control = (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => void run(() => confirmParticipant(participantId))}
      >
        {pending ? "Working…" : "Confirm"}
      </Button>
    );
  } else if (status === "confirmed" || status === "attended") {
    control = (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => void run(() => markParticipantCompleted(participantId))}
      >
        {pending ? "Working…" : "Mark Completed"}
      </Button>
    );
  }

  if (!control && !error) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      {control}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
