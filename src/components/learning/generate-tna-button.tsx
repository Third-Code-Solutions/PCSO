"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateTnaForEmployee } from "@/lib/actions/ldm/tna";

interface Props {
  employeeId: string;
  cycleYear: number;
  canManage: boolean;
}

/**
 * LDM-013 — "Generate TNA" control. Runs the competency gap analysis for one
 * employee against the current cycle year and refreshes the gap list.
 */
export function GenerateTnaButton({ employeeId, cycleYear, canManage }: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (!canManage) return null;

  async function onGenerate(): Promise<void> {
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const result = await generateTnaForEmployee(employeeId, cycleYear);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setMessage(
        `Analysis complete — ${result.data.insertedGaps} gap(s) recorded.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" disabled={pending} onClick={() => void onGenerate()}>
        {pending ? "Analyzing…" : "Generate TNA"}
      </Button>
      {message && <p className="text-[11px] text-emerald-600">{message}</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
