"use client";

/**
 * Summary of Ratings exports (TOR 1.2.21) — CSV and printable PDF downloads,
 * surfaced next to the Rating Sheet / ranking table in the selection console.
 */

import * as React from "react";
import { toast } from "sonner";
import { DownloadIcon, FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  generateSummaryOfRatingsCsv,
  generateSummaryOfRatingsPdf,
} from "@/lib/actions/rpm/selection";

interface SummaryOfRatingsButtonsProps {
  vacancyId: string;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export function SummaryOfRatingsButtons({
  vacancyId,
}: SummaryOfRatingsButtonsProps) {
  const [pending, setPending] = React.useState<"csv" | "pdf" | null>(null);

  async function handleCsv() {
    setPending("csv");
    try {
      const result = await generateSummaryOfRatingsCsv(vacancyId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      triggerDownload(
        new Blob([result.data.csv], { type: "text/csv;charset=utf-8" }),
        result.data.filename,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export CSV");
    } finally {
      setPending(null);
    }
  }

  async function handlePdf() {
    setPending("pdf");
    try {
      const result = await generateSummaryOfRatingsPdf(vacancyId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      triggerDownload(
        base64ToBlob(result.data.pdfBase64, "application/pdf"),
        result.data.filename,
      );
      toast.success(`Summary of Ratings generated (${result.data.serial}).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export PDF");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleCsv}
        disabled={pending !== null}
      >
        <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
        {pending === "csv" ? "Exporting…" : "Summary of Ratings (CSV)"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handlePdf}
        disabled={pending !== null}
      >
        <FileTextIcon className="mr-1.5 h-3.5 w-3.5" />
        {pending === "pdf" ? "Generating…" : "Summary of Ratings (PDF)"}
      </Button>
    </div>
  );
}

export default SummaryOfRatingsButtons;
