'use client';

import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { importBiometric, type ImportResult } from '@/app/(dashboard)/attendance/actions';

export default function ImportBiometricPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error('Please select a CSV file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const csvText = ev.target?.result;
      if (typeof csvText !== 'string') {
        toast.error('Failed to read file.');
        return;
      }

      startTransition(async () => {
        try {
          const res = await importBiometric(
            {
              employeeIdColumn: 'employee_id',
              dateColumn: 'date',
              timeInColumn: 'time_in',
              timeOutColumn: 'time_out',
              rows: [], // server re-parses from csvText
            },
            csvText,
          );
          setResult(res);
          if (res.errors.length === 0) {
            toast.success(`Imported ${res.imported} records successfully.`);
          } else {
            toast.warning(`Imported ${res.imported} records with ${res.errors.length} errors.`);
          }
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : 'Import failed');
        }
      });
    };
    reader.readAsText(file);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2545]">Import Biometric Data</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload a CSV export from your biometric device. The file must contain columns:
          <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">employee_id</code>,
          <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">date</code>,
          <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">time_in</code>,
          <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">time_out</code>.
        </p>
      </div>

      {/* CSV format reference */}
      <div className="mb-6 rounded-lg border border-[#0B2545]/10 bg-[#FAF4E6] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0B2545]">
          Expected CSV Format
        </p>
        <pre className="overflow-x-auto rounded bg-white p-3 text-xs text-gray-700">
{`employee_id,date,time_in,time_out
abc123,2025-03-01,08:00,17:00
abc123,2025-03-02,08:05,17:02
def456,2025-03-01,08:00,17:00`}
        </pre>
        <p className="mt-2 text-xs text-gray-500">
          Dates must be YYYY-MM-DD. Times must be HH:MM (24-hour). Leave time_in or time_out blank
          if missing.
        </p>
      </div>

      {/* Upload form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="csv-file" className="block text-sm font-medium text-[#0B2545]">
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

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-[#FAF4E6] transition hover:bg-[#13315C] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Importing…' : 'Import Records'}
        </button>
      </form>

      {/* Results */}
      {result && (
        <div className="mt-6 rounded-lg border border-[#0B2545]/10 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-[#0B2545]">Import Results</h2>
          <div className="flex gap-6">
            <div>
              <div className="text-2xl font-bold text-emerald-600">{result.imported}</div>
              <div className="text-xs text-gray-500">Records Imported</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">{result.skipped}</div>
              <div className="text-xs text-gray-500">Skipped</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{result.errors.length}</div>
              <div className="text-xs text-gray-500">Errors</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-red-700">Row Errors:</p>
              <ul className="max-h-40 overflow-y-auto rounded border border-red-100 bg-red-50 p-3 text-xs space-y-1">
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
