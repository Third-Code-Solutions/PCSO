"use client";

/**
 * Selection-console exports: Summary of Ratings (TOR 1.2.21) as CSV / PDF,
 * plus the Assessment Form (RPM-013) and Rating Sheet (RPM-017) PDFs.
 */

import * as React from "react";
import { toast } from "sonner";
import { DownloadIcon, FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  downloadBase64Pdf,
  triggerDownload,
} from "@/components/recruitment/download";
import {
  generateAssessmentFormPdf,
  generateRatingSheetPdf,
  generateSummaryOfRatingsCsv,
  generateSummaryOfRatingsPdf,
} from "@/lib/actions/rpm/selection";

interface SummaryOfRatingsButtonsProps {
  vacancyId: string;
}

const PDF_EXPORTS = {
  assessment: { label: "Assessment Form", generate: generateAssessmentFormPdf },
  rating: { label: "Rating Sheet", generate: generateRatingSheetPdf },
  summary: {
    label: "Summary of Ratings (PDF)",
    generate: generateSummaryOfRatingsPdf,
  },
} as const;

type PdfKey = keyof typeof PDF_EXPORTS;

export function SummaryOfRatingsButtons({
  vacancyId,
}: SummaryOfRatingsButtonsProps) {
  const [pending, setPending] = React.useState<"csv" | PdfKey | null>(null);

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

  async function handlePdf(key: PdfKey) {
    const { label, generate } = PDF_EXPORTS[key];
    setPending(key);
    try {
      const result = await generate(vacancyId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      downloadBase64Pdf(result.data.pdfBase64, result.data.filename);
      toast.success(`${label} generated (${result.data.serial}).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export PDF");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(Object.keys(PDF_EXPORTS) as PdfKey[]).map((key) => (
        <Button
          key={key}
          type="button"
          size="sm"
          variant="outline"
          onClick={() => handlePdf(key)}
          disabled={pending !== null}
        >
          <FileTextIcon className="mr-1.5 h-3.5 w-3.5" />
          {pending === key ? "Generating…" : PDF_EXPORTS[key].label}
        </Button>
      ))}
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
    </div>
  );
}

export default SummaryOfRatingsButtons;
