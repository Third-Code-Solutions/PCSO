"use client";

/**
 * RPM-021: Notify applicants of assessment results.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BellIcon } from "lucide-react";

interface NotifyResultsButtonProps {
  vacancyId: string;
  notifyAction: (
    vacancyId: string,
  ) => Promise<{ ok: boolean; error?: string; data?: { notified: number } }>;
}

export function NotifyResultsButton({
  vacancyId,
  notifyAction,
}: NotifyResultsButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleClick = async () => {
    setIsPending(true);
    setStatus(null);

    try {
      const result = await notifyAction(vacancyId);

      if (!result.ok) {
        setStatus({
          type: "error",
          message: result.error ?? "Failed to notify applicants",
        });
        setIsPending(false);
        return;
      }

      setStatus({
        type: "success",
        message: `Notified ${result.data?.notified ?? 0} applicants`,
      });
      setIsPending(false);
      router.refresh();
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleClick}
        disabled={isPending}
        size="sm"
        className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
      >
        <BellIcon className="mr-1.5 h-4 w-4" />
        {isPending ? "Notifying..." : "Notify Exam Results"}
      </Button>
      {status && (
        <p
          className={`text-xs ${
            status.type === "success" ? "text-green-600" : "text-destructive"
          }`}
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
