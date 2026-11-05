"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateBankHashFile } from "@/app/(dashboard)/payroll/bank-configs/actions";

interface BankFileDownloadProps {
  periodId: string;
  bankConfigs: { id: string; bankName: string }[];
}

/** PAY-010 / H-15: generate and download the bank hash file for this period. */
export function BankFileDownload({
  periodId,
  bankConfigs,
}: BankFileDownloadProps) {
  const [bankConfigId, setBankConfigId] = React.useState(
    bankConfigs[0]?.id ?? "",
  );
  const [isPending, startTransition] = React.useTransition();

  if (bankConfigs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No bank file configuration yet — add one under Payroll › Bank Configs to
        generate the bank file.
      </p>
    );
  }

  function handleDownload() {
    startTransition(async () => {
      try {
        const { csvContent, filename, recordCount } =
          await generateBankHashFile({ periodId, bankConfigId });
        const url = URL.createObjectURL(
          new Blob([csvContent], { type: "text/csv;charset=utf-8" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`Bank file generated (${recordCount} records).`);
      } catch (err) {
        if (
          typeof err === "object" &&
          err !== null &&
          "digest" in err &&
          typeof (err as { digest: unknown }).digest === "string" &&
          (err as { digest: string }).digest.startsWith("NEXT_")
        ) {
          throw err;
        }
        toast.error(
          err instanceof Error ? err.message : "Failed to generate bank file",
        );
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={bankConfigId} onValueChange={setBankConfigId}>
        <SelectTrigger className="w-56" aria-label="Bank">
          <SelectValue placeholder="Select bank" />
        </SelectTrigger>
        <SelectContent>
          {bankConfigs.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.bankName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={isPending || !bankConfigId}
      >
        <Download className="mr-2 h-4 w-4" />
        {isPending ? "Generating…" : "Bank File"}
      </Button>
    </div>
  );
}
