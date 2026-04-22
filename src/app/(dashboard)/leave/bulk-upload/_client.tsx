"use client";

import { useState, useTransition } from "react";
import { uploadLeaveLedgerCsv } from "@/lib/actions/leave-gaps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, Upload } from "lucide-react";

export function BulkUploadForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    uploadId: string;
    recordCount: number;
    validCount: number;
    errorCount: number;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);

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

          {result.validCount > 0 && (
            <div className="p-4 rounded-lg border bg-blue-50">
              <p className="text-sm text-blue-900 mb-3">
                {result.validCount} valid records ready to commit.
              </p>
              <Button variant="default" disabled>
                Commit to Database (Not Implemented)
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Full commit implementation requires storing parsed records and
                batch insert logic.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
