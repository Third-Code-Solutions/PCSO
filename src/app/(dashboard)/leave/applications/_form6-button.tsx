"use client";

/**
 * Form 6 PDF download button — TOR 1.4.11.
 *
 * Renders a compact button that calls generateLeaveForm6Pdf and triggers a
 * browser download of the FILLED CSC Form No. 6 for one leave application.
 * Used in the leave applications tables (own applications + admin history).
 */

import { useTransition } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateLeaveForm6Pdf } from "@/lib/actions/leave/form6";

interface Form6DownloadButtonProps {
  leaveApplicationId: string;
}

export function Form6DownloadButton({
  leaveApplicationId,
}: Form6DownloadButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDownload() {
    startTransition(async () => {
      try {
        const result = await generateLeaveForm6Pdf({ leaveApplicationId });
        const bytes = Uint8Array.from(atob(result.base64), (c) =>
          c.charCodeAt(0),
        );
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = result.filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to generate Form 6 PDF.",
        );
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs"
      onClick={handleDownload}
      disabled={isPending}
      title="Download CSC Form No. 6 (PDF)"
    >
      <FileDown className="mr-1 h-3.5 w-3.5" />
      {isPending ? "Preparing..." : "Form 6"}
    </Button>
  );
}
