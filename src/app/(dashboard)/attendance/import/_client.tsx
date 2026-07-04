"use client";

/**
 * /attendance/import — Biometric CSV import
 *
 * Two-phase UX:
 *  1. Upload + Dry Run: server parses, validates (Zod per row), resolves
 *     employee IDs, and returns a preview with sample + errors.
 *  2. Confirm Commit: server re-reads the same CSV, upserts in chunks of 500.
 *
 * Per-row errors are surfaced before any write, giving admins a chance to
 * fix the upstream export before committing bad data.
 */

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  importBiometric,
  type ImportPreview,
  type ImportResult,
} from "./actions";

export function ImportBiometricClient() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);

  function readFile(): Promise<string | null> {
    return new Promise((resolve) => {
      const file = fileRef.current?.files?.[0];
      if (!file) {
        toast.error("Please select a CSV file.");
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result;
        resolve(typeof text === "string" ? text : null);
      };
      reader.onerror = () => {
        toast.error("Failed to read file.");
        resolve(null);
      };
      reader.readAsText(file);
    });
  }

  function handleDryRun(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void readFile().then((text) => {
      if (!text) return;
      setCsvText(text);
      setResult(null);

      startTransition(async () => {
        try {
          const res = await importBiometric(
            {
              employeeIdColumn: "employee_id",
              dateColumn: "date",
              timeInColumn: "time_in",
              timeOutColumn: "time_out",
            },
            text,
            { dryRun: true },
          );
          if (res.dryRun) {
            setPreview(res);
            if (res.validRows === 0) {
              toast.error("No valid rows found. Fix the errors below.");
            } else {
              toast.success(
                `${res.validRows} of ${res.totalRows} rows ready to import.`,
              );
            }
          }
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : "Preview failed");
        }
      });
    });
  }

  function handleCommit() {
    if (!csvText || !preview || preview.validRows === 0) return;
    startTransition(async () => {
      try {
        const res = await importBiometric(
          {
            employeeIdColumn: "employee_id",
            dateColumn: "date",
            timeInColumn: "time_in",
            timeOutColumn: "time_out",
          },
          csvText,
          { dryRun: false },
        );
        if (!res.dryRun) {
          setResult(res);
          setPreview(null);
          if (res.errors.length === 0) {
            toast.success(`Imported ${res.imported} records.`);
          } else {
            toast.warning(
              `Imported ${res.imported} records with ${res.errors.length} errors.`,
            );
          }
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  function handleReset() {
    setPreview(null);
    setResult(null);
    setCsvText(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2545]">
          Import Biometric Data
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload a CSV export from your biometric device. The file must contain
          columns:
          <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">
            employee_id
          </code>
          ,
          <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">
            date
          </code>
          ,
          <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">
            time_in
          </code>
          ,
          <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">
            time_out
          </code>
          .
        </p>
      </div>

      {/* CSV format reference */}
      <div className="mb-6 rounded-lg border border-[#0B2545]/10 bg-[#FAF4E6] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0B2545]">
          Expected CSV Format
        </p>
        <pre className="overflow-x-auto rounded bg-white p-3 text-xs text-gray-700">
          {`employee_id,date,time_in,time_out
SEN-0001,2025-03-01,08:00,17:00
SEN-0001,2025-03-02,08:05,17:02
SEN-0042,2025-03-01,08:00,17:00`}
        </pre>
        <p className="mt-2 text-xs text-gray-500">
          Dates must be YYYY-MM-DD. Times must be HH:MM (24-hour). Use either
          the employee UUID or their employee number. Leave time_in or time_out
          blank if missing.
        </p>
        <a
          href="/api/templates/attendance-import"
          download
          className="mt-2 inline-block text-xs font-semibold text-[#0B2545] underline underline-offset-2 hover:text-[#13315C]"
        >
          Download template CSV
        </a>
      </div>

      {/* Upload form */}
      <form onSubmit={handleDryRun} className="space-y-4">
        <div>
          <label
            htmlFor="csv-file"
            className="block text-sm font-medium text-[#0B2545]"
          >
            CSV File
          </label>
          <input
            id="csv-file"
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm file:mr-4 file:rounded file:border-0 file:bg-[#0B2545] file:px-3 file:py-1 file:text-xs file:font-medium file:text-[#FAF4E6] hover:file:bg-[#13315C]"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-lg border border-[#C8A84B] bg-[#FAF4E6] px-4 py-2.5 text-sm font-semibold text-[#0B2545] transition hover:bg-[#E0C77A]/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending && !preview ? "Validating…" : "Validate (Dry Run)"}
          </button>
          {(preview || result) && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Reset
            </button>
          )}
        </div>
      </form>

      {/* Dry-run preview */}
      {preview && !result && (
        <div className="mt-6 rounded-lg border border-[#0B2545]/10 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-[#0B2545]">
            Preview
          </h2>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-bold text-[#0B2545]">
                {preview.totalRows}
              </div>
              <div className="text-xs text-gray-500">Total Rows</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-600">
                {preview.validRows}
              </div>
              <div className="text-xs text-gray-500">Valid</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {preview.invalidRows}
              </div>
              <div className="text-xs text-gray-500">Invalid</div>
            </div>
          </div>

          {preview.sample.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Sample of valid rows
              </p>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-2 py-1">Employee</th>
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1">In</th>
                    <th className="px-2 py-1">Out</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((s, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-2 py-1 font-mono">
                        {s.employeeId.slice(0, 8)}…
                      </td>
                      <td className="px-2 py-1 font-mono">{s.date}</td>
                      <td className="px-2 py-1 font-mono">{s.timeIn ?? "—"}</td>
                      <td className="px-2 py-1 font-mono">
                        {s.timeOut ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.errors.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold text-red-700">
                Row Errors ({preview.errors.length})
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-red-100 bg-red-50 p-3 text-xs">
                {preview.errors.map((e, i) => (
                  <li key={i} className="text-red-700">
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={handleCommit}
            disabled={isPending || preview.validRows === 0}
            className="w-full rounded-lg bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-[#FAF4E6] transition hover:bg-[#13315C] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Importing…" : `Commit ${preview.validRows} records`}
          </button>
        </div>
      )}

      {/* Final result */}
      {result && (
        <div className="mt-6 rounded-lg border border-[#0B2545]/10 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-[#0B2545]">
            Import Results
          </h2>
          <div className="flex gap-6">
            <div>
              <div className="text-2xl font-bold text-emerald-600">
                {result.imported}
              </div>
              <div className="text-xs text-gray-500">Records Imported</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">
                {result.skipped}
              </div>
              <div className="text-xs text-gray-500">Skipped</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {result.errors.length}
              </div>
              <div className="text-xs text-gray-500">Errors</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-red-700">
                Row Errors:
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-red-100 bg-red-50 p-3 text-xs">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-red-700">
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
