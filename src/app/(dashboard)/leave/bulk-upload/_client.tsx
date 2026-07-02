"use client";

import { useState, useTransition } from "react";
import {
  uploadLeaveLedgerCsv,
  commitLeaveLedgerUpload,
} from "@/lib/actions/leave-gaps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertCircle, CheckCircle, DatabaseZap, Upload } from "lucide-react";

interface RowError {
  row: number;
  message: string;
}

export function BulkUploadForm() {
  const [isPending, startTransition] = useTransition();
  const [isCommitting, startCommit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    uploadId: string;
    recordCount: number;
    validCount: number;
    errorCount: number;
    errors: RowError[];
  } | null>(null);
  const [committedCount, setCommittedCount] = useState<number | null>(null);
  const [commitErrors, setCommitErrors] = useState<RowError[]>([]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setCommittedCount(null);
    setCommitErrors([]);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const uploadResult = await uploadLeaveLedgerCsv(formData);
        setResult(uploadResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  function handleCommit() {
    if (!result || result.validCount === 0) return;

    const confirmed = window.confirm(
      `Commit ${result.validCount} leave ledger record(s) to the live database?\n\n` +
        "Rows are re-validated against employees, leave types, and existing " +
        "ledger entries. If any row fails, nothing is written.",
    );
    if (!confirmed) return;

    setCommitErrors([]);

    startCommit(async () => {
      try {
        const commitResult = await commitLeaveLedgerUpload(result.uploadId);
        if (commitResult.errors.length > 0) {
          setCommitErrors(commitResult.errors);
          toast.error(
            `Commit blocked — ${commitResult.errors.length} validation error(s). No records were written.`,
          );
        } else {
          setCommittedCount(commitResult.processedCount);
          toast.success(
            `${commitResult.processedCount} leave ledger record(s) committed.`,
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Commit failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="file">Select CSV File</Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept=".csv"
            required
            disabled={isPending}
          />
        </div>

        <Button type="submit" disabled={isPending}>
          <Upload className="h-4 w-4 mr-2" />
          {isPending ? "Uploading & Validating..." : "Upload & Validate"}
        </Button>
      </form>

      {result && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200">
            <CheckCircle className="h-5 w-5" />
            <div className="flex-1 text-sm">
              <p className="font-medium">Validation Complete</p>
              <p className="text-xs mt-1">
                {result.recordCount} records processed • {result.validCount}{" "}
                valid • {result.errorCount} errors
              </p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-lg border bg-amber-50 p-4">
              <h4 className="text-sm font-semibold text-amber-900 mb-2">
                Validation Errors ({result.errors.length})
              </h4>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {result.errors.slice(0, 20).map((err, idx) => (
                  <div
                    key={idx}
                    className="text-xs text-amber-800 font-mono bg-white p-2 rounded border border-amber-200"
                  >
                    Row {err.row}: {err.message}
                  </div>
                ))}
                {result.errors.length > 20 && (
                  <p className="text-xs text-amber-700 italic">
                    ... and {result.errors.length - 20} more errors
                  </p>
                )}
              </div>
            </div>
          )}

          {result.validCount > 0 && committedCount === null && (
            <div className="p-4 rounded-lg border bg-blue-50">
              <p className="text-sm text-blue-900 mb-3">
                {result.validCount} valid records ready to commit.
              </p>
              <Button
                variant="default"
                onClick={handleCommit}
                disabled={isCommitting}
              >
                <DatabaseZap className="h-4 w-4 mr-2" />
                {isCommitting ? "Committing..." : "Commit to Database"}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                All-or-nothing: rows are re-validated on commit and nothing is
                written if any row fails.
              </p>
            </div>
          )}

          {commitErrors.length > 0 && (
            <div className="rounded-lg border bg-red-50 p-4">
              <h4 className="text-sm font-semibold text-red-900 mb-2">
                Commit Blocked — {commitErrors.length} error(s), no records
                written
              </h4>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {commitErrors.slice(0, 20).map((err, idx) => (
                  <div
                    key={idx}
                    className="text-xs text-red-800 font-mono bg-white p-2 rounded border border-red-200"
                  >
                    Row {err.row}: {err.message}
                  </div>
                ))}
                {commitErrors.length > 20 && (
                  <p className="text-xs text-red-700 italic">
                    ... and {commitErrors.length - 20} more errors
                  </p>
                )}
              </div>
            </div>
          )}

          {committedCount !== null && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle className="h-5 w-5" />
              <p className="text-sm font-medium">
                {committedCount} leave ledger record(s) committed to the
                database.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
