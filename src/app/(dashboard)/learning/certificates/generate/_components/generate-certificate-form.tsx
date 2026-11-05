"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Award, Loader2, CheckCircle2 } from "lucide-react";
import { generateTrainingCertificate } from "@/lib/actions/ldm/certificates";

interface Participant {
  participantId: string;
  employeeId: string;
  employeeNo: string;
  employeeFirst: string;
  employeeLast: string;
  programTitle: string;
  programCode: string;
  runId: string;
  runNumber: string;
  completedAt: Date | null;
}

interface GenerateCertificateFormProps {
  participants: Participant[];
}

/** Issuer is resolved server-side from the session (H-26). */
export function GenerateCertificateForm({
  participants,
}: GenerateCertificateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === participants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(participants.map((p) => p.participantId)));
    }
  };

  const handleGenerate = async (participantId: string) => {
    setGeneratingId(participantId);
    startTransition(async () => {
      try {
        const result = await generateTrainingCertificate({ participantId });

        if (result.success) {
          router.push(
            `/learning/certificates?success=Certificate generated successfully&certificate=${result.data?.certificateNumber}`,
          );
        } else {
          router.push(
            `/learning/certificates/generate?error=Failed to generate certificate`,
          );
        }
      } catch (error) {
        router.push(
          `/learning/certificates/generate?error=${error instanceof Error ? error.message : "Failed to generate certificate"}`,
        );
      } finally {
        setGeneratingId(null);
      }
    });
  };

  const handleBatchGenerate = async () => {
    if (selectedIds.size === 0) return;

    startTransition(async () => {
      let successCount = 0;
      let errorCount = 0;

      for (const participantId of selectedIds) {
        setGeneratingId(participantId);
        try {
          const result = await generateTrainingCertificate({ participantId });

          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }

      setGeneratingId(null);
      setSelectedIds(new Set());

      if (errorCount === 0) {
        router.push(
          `/learning/certificates?success=Generated ${successCount} certificate${successCount !== 1 ? "s" : ""} successfully`,
        );
      } else {
        router.push(
          `/learning/certificates?warning=Generated ${successCount} certificates, ${errorCount} failed`,
        );
      }
    });
  };

  return (
    <div className="divide-y">
      {/* Batch Actions Bar */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/20">
        <div className="flex items-center gap-3">
          <Checkbox
            id="select-all"
            checked={
              participants.length > 0 &&
              selectedIds.size === participants.length
            }
            onCheckedChange={handleSelectAll}
            disabled={isPending}
          />
          <label
            htmlFor="select-all"
            className="text-xs font-medium cursor-pointer"
          >
            Select All ({selectedIds.size} selected)
          </label>
        </div>
        {selectedIds.size > 0 && (
          <Button
            onClick={handleBatchGenerate}
            disabled={isPending}
            size="sm"
            className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Award className="mr-2 h-4 w-4" />
                Generate {selectedIds.size} Certificate
                {selectedIds.size !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Participant List */}
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/10">
          <tr>
            {["", "Employee", "Program", "Run", "Completed", "Action"].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {participants.map((p) => {
            const isGenerating = generatingId === p.participantId;
            const isSelected = selectedIds.has(p.participantId);

            return (
              <tr
                key={p.participantId}
                className={`transition-colors ${
                  isGenerating
                    ? "bg-pcso-navy/5"
                    : isSelected
                      ? "bg-amber-50"
                      : "hover:bg-muted/20"
                }`}
              >
                <td className="px-4 py-3 w-12">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggle(p.participantId)}
                    disabled={isPending}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {p.employeeFirst} {p.employeeLast}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {p.employeeNo}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>{p.programTitle}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {p.programCode}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{p.runNumber}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {p.completedAt
                    ? new Date(p.completedAt).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <Button
                    onClick={() => handleGenerate(p.participantId)}
                    disabled={isPending}
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    className={
                      isSelected
                        ? "bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
                        : ""
                    }
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                        Generate
                      </>
                    )}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
