"use client";

/**
 * Income/deduction CSV upload client — TOR 1.8.1.
 *
 * Flow: pick CSV → client-side preview (same pure parser the server uses) →
 * "Upload & Stage" (server re-parses + stages) → "Commit" (all-or-nothing
 * write into payroll_employee_inputs). Committed values are consumed by
 * Process Payroll, so an already-computed run must be re-processed.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Download, FileUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  parsePayrollInputCsv,
  PAYROLL_INPUT_CSV_HEADERS,
  type PayrollInputRow,
  type PayrollInputRowError,
} from "@/lib/utils/payroll/bulk-inputs";
import {
  uploadPayrollInputsCsv,
  commitPayrollInputsUpload,
} from "@/lib/actions/payroll-gaps";

interface CommittedInputRow {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  otherIncome: string;
  otherDeductions: string;
  remarks: string | null;
}

interface UploadHistoryRow {
  id: string;
  fileName: string;
  recordCount: number;
  validCount: number;
  errorCount: number;
  status: string;
  createdAt: string;
}

interface Props {
  periodId: string;
  periodName: string;
  periodStatus: string;
  periodScope: string;
  committedInputs: CommittedInputRow[];
  uploads: UploadHistoryRow[];
}

/** Mirrors EDITABLE_PERIOD_STATUSES / BULK_INPUT_SCOPES in payroll-gaps.ts. */
const EDITABLE_STATUSES = ["draft", "processing"];
const BULK_INPUT_SCOPES = [
  "regular",
  "jo_cos",
  "special",
  "confidential_agents",
];

const UPLOAD_STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  committed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

interface StagedUpload {
  uploadId: string;
  validCount: number;
  errorCount: number;
  errors: Array<{ row: number; message: string }>;
}

function formatPeso(value: string): string {
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return "₱0.00";
  return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isNextRedirect(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest: string }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_")
  );
}

export function InputsUploadClient({
  periodId,
  periodName,
  periodStatus,
  periodScope,
  committedInputs,
  uploads,
}: Props) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = React.useTransition();

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<{
    rows: PayrollInputRow[];
    errors: PayrollInputRowError[];
    parseError: string | null;
  } | null>(null);
  const [staged, setStaged] = React.useState<StagedUpload | null>(null);

  const editable = EDITABLE_STATUSES.includes(periodStatus);
  const scopeOk = BULK_INPUT_SCOPES.includes(periodScope);
  const canUpload = editable && scopeOk;

  function downloadTemplate() {
    const csv =
      PAYROLL_INPUT_CSV_HEADERS.join(",") +
      "\nPCSO-2024-0001,1500.00,0,Hazard pay adjustment\nPCSO-2024-0002,0,250.00,Cooperative deduction\n";
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payroll-inputs-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setStaged(null);
    if (!file) {
      setPreview(null);
      return;
    }
    try {
      const text = await file.text();
      const result = parsePayrollInputCsv(text);
      setPreview({
        rows: result.rows,
        errors: result.errors,
        parseError: null,
      });
    } catch (err) {
      setPreview({
        rows: [],
        errors: [],
        parseError:
          err instanceof Error ? err.message : "Failed to parse the file",
      });
    }
  }

  function handleStage() {
    if (!selectedFile) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("periodId", periodId);
        formData.set("file", selectedFile);
        const result = await uploadPayrollInputsCsv(formData);
        setStaged({
          uploadId: result.uploadId,
          validCount: result.validCount,
          errorCount: result.errorCount,
          errors: result.errors,
        });
        if (result.validCount === 0) {
          toast.error("No valid rows to stage — fix the errors and re-upload.");
        } else {
          toast.success(
            `Staged ${result.validCount} row${result.validCount === 1 ? "" : "s"} for commit.`,
          );
        }
      } catch (err) {
        if (isNextRedirect(err)) throw err;
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  function handleCommit() {
    if (!staged) return;
    startTransition(async () => {
      try {
        const result = await commitPayrollInputsUpload(staged.uploadId);
        if (result.errors.length > 0) {
          // SEC-010: any error aborts with zero writes.
          toast.error(
            `Commit aborted — ${result.errors.length} validation error${result.errors.length === 1 ? "" : "s"}. Nothing was written.`,
          );
          setStaged({ ...staged, errors: result.errors });
          return;
        }
        toast.success(
          `${result.processedCount} input row${result.processedCount === 1 ? "" : "s"} committed.`,
        );
        if (result.requiresReprocessing) {
          toast.warning(
            "This run already has computed records — re-run Process Payroll for the imported values to take effect.",
          );
        }
        setStaged(null);
        setSelectedFile(null);
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      } catch (err) {
        if (isNextRedirect(err)) throw err;
        toast.error(err instanceof Error ? err.message : "Commit failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Eligibility notices */}
      {!scopeOk && (
        <Notice>
          Income/deduction uploads apply to General, JO/COS, Special, and
          Confidential Agents runs. This period is a &quot;{periodScope}&quot;
          run, which computes its own amounts.
        </Notice>
      )}
      {scopeOk && !editable && (
        <Notice>
          {periodName} is {periodStatus} — inputs can only change while the run
          is draft or processing. Corrections go through an adjustment payroll.
        </Notice>
      )}

      {/* Upload card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Upload CSV</CardTitle>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Columns: <code>{PAYROLL_INPUT_CSV_HEADERS.join(", ")}</code>.
            Amounts are plain decimals (no ₱ or commas). One row per employee —
            re-uploads overwrite prior values for the same employee. Excel
            workbooks must be saved as CSV before uploading.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={!canUpload || isPending}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <Button
              onClick={handleStage}
              disabled={
                !canUpload ||
                isPending ||
                !selectedFile ||
                Boolean(preview?.parseError)
              }
              className="bg-[#0B2545] text-white hover:bg-[#13315C]"
            >
              <FileUp className="mr-2 h-4 w-4" />
              {isPending ? "Working..." : "Upload & Stage"}
            </Button>
            {staged && staged.validCount > 0 && (
              <Button
                onClick={handleCommit}
                disabled={isPending}
                className="bg-emerald-700 text-white hover:bg-emerald-800"
              >
                <Upload className="mr-2 h-4 w-4" />
                Commit {staged.validCount} Row
                {staged.validCount === 1 ? "" : "s"}
              </Button>
            )}
          </div>

          {preview?.parseError && <Notice>{preview.parseError}</Notice>}

          {staged && (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
              Staged upload: <strong>{staged.validCount}</strong> valid ·{" "}
              <strong>{staged.errorCount}</strong> error
              {staged.errorCount === 1 ? "" : "s"}. Commit is all-or-nothing —
              rows with errors are never partially written.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation errors */}
      {preview &&
        !preview.parseError &&
        (preview.errors.length > 0 || (staged?.errors.length ?? 0) > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-red-700">
                Validation Errors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">CSV Line</TableHead>
                      <TableHead>Problem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(staged?.errors.length
                      ? staged.errors
                      : preview.errors
                    ).map((err, idx) => (
                      <TableRow key={`${err.row}-${idx}`}>
                        <TableCell className="font-mono text-sm">
                          {err.row}
                        </TableCell>
                        <TableCell className="text-sm text-red-700">
                          {err.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Staged preview (client-side parse of the selected file) */}
      {preview && !preview.parseError && preview.rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Preview — {preview.rows.length} valid row
              {preview.rows.length === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee No.</TableHead>
                    <TableHead className="text-right">Other Income</TableHead>
                    <TableHead className="text-right">
                      Other Deductions
                    </TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row) => (
                    <TableRow key={row.csvRow}>
                      <TableCell className="font-mono text-sm">
                        {row.employeeNumber}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatPeso(String(row.otherIncome))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatPeso(String(row.otherDeductions))}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.remarks ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Committed inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Committed Inputs ({committedInputs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {committedInputs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No committed income/deduction inputs for this period yet.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Other Income</TableHead>
                    <TableHead className="text-right">
                      Other Deductions
                    </TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {committedInputs.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {row.lastName}, {row.firstName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {row.employeeNo}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatPeso(row.otherIncome)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatPeso(row.otherDeductions)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.remarks ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload history */}
      {uploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Valid</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell
                      className="max-w-56 truncate text-sm"
                      title={u.fileName}
                    >
                      {u.fileName}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {u.recordCount}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {u.validCount}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {u.errorCount}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${UPLOAD_STATUS_BADGE[u.status] ?? ""}`}
                      >
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(u.createdAt).toLocaleString("en-PH")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
      <p className="text-sm text-amber-800">{children}</p>
    </div>
  );
}
