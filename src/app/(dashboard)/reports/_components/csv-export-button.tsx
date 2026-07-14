"use client";

/**
 * Shared CSV download button for the PIMM report pages.
 * Receives a fully serialized CSV string (built with
 * buildCsvFromTable / buildAdhocCsv from utils/pimm/adhoc-report)
 * and triggers a browser download with the UTF-8 BOM prefix so
 * Excel renders Filipino names (ñ, é) correctly.
 */

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CsvExportButtonProps {
  fileName: string;
  csv: string;
  disabled?: boolean;
  label?: string;
}

export function CsvExportButton({
  fileName,
  csv,
  disabled = false,
  label = "Export CSV",
}: CsvExportButtonProps) {
  function handleDownload() {
    // U+FEFF = UTF-8 BOM so Excel detects UTF-8 (house convention).
    const utf8Bom = String.fromCharCode(0xfeff);
    const blob = new Blob([utf8Bom + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleDownload}
      disabled={disabled || csv.length === 0}
    >
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
}
