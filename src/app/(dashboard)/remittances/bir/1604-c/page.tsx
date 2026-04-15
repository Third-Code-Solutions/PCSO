/**
 * BIR Form 1604-C — Annual Information Return + Alphalist Page
 */

'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layouts/page-header';
import {
  getBir1601CBatches,
  generateBir1604CAnnualReturn,
  exportBir1604CAlphalist,
  markBir1604CFiled,
} from '../actions';

type Batch = Awaited<ReturnType<typeof getBir1601CBatches>>[number];

function fmt(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return '₱0.00';
  return `₱${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  generated: 'bg-blue-100 text-blue-700',
  submitted: 'bg-green-100 text-green-700',
  acknowledged: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

export default function Bir1604CPage() {
  const currentYear = new Date().getFullYear();
  const [batches, setBatches] = React.useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = React.useState(true);

  const [year, setYear] = React.useState(String(currentYear - 1));
  const [remarks, setRemarks] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const [generateError, setGenerateError] = React.useState<string | null>(null);

  const [exportingId, setExportingId] = React.useState<string | null>(null);

  const [filedBatch, setFiledBatch] = React.useState<Batch | null>(null);
  const [referenceNo, setReferenceNo] = React.useState('');
  const [filedDate, setFiledDate] = React.useState('');
  const [filingLoading, setFilingLoading] = React.useState(false);
  const [filingError, setFilingError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Filter to annual batches (full year ranges) from the bir type
    getBir1601CBatches({ page: 1, perPage: 20 })
      .then((all) => {
        // Annual 1604-C batches span full year: periodStart ends in 01-01
        const annual = all.filter((b) => b.periodStart.endsWith('-01-01'));
        setBatches(annual);
      })
      .finally(() => setLoadingBatches(false));
  }, []);

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGenerateError(null);
    setGenerating(true);
    try {
      const result = await generateBir1604CAnnualReturn({
        year,
        remarks: remarks || undefined,
      });
      setBatches((prev) => [result.batch, ...prev]);
      setRemarks('');
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate return.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleExportAlphalist(batchId: string) {
    setExportingId(batchId);
    try {
      const result = await exportBir1604CAlphalist(batchId);
      const binaryStr = atob(result.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExportingId(null);
    }
  }

  async function handleMarkFiled(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!filedBatch) return;
    setFilingError(null);
    setFilingLoading(true);
    try {
      await markBir1604CFiled({ batchId: filedBatch.id, referenceNo, filedDate });
      setBatches((prev) =>
        prev.map((b) =>
          b.id === filedBatch.id ? { ...b, status: 'submitted', referenceNo } : b,
        ),
      );
      setFiledBatch(null);
    } catch (err: unknown) {
      setFilingError(err instanceof Error ? err.message : 'Failed to mark as filed.');
    } finally {
      setFilingLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="BIR Form 1604-C"
        subtitle="Annual Information Return of Income Taxes Withheld on Compensation + Alphalist"
        backHref="/remittances/bir"
      />

      <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-800">
        <strong>Filing Deadline:</strong> January 31 of the year following the calendar year
        covered. The alphalist (Schedule 1) must be submitted via eBIRForms or BIR ADAS. The CSV
        export from this page is compatible with eBIRForms alphalist import.
      </div>

      {/* Generate form */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-senate-navy">
          Generate Annual 1604-C Return
        </h3>
        <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Calendar Year
            </label>
            <input
              type="number"
              min={2020}
              max={currentYear}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-1 w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-senate-navy focus:outline-none"
              required
            />
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Remarks (optional)
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              maxLength={200}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-senate-navy focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={generating}
            className="rounded-lg bg-senate-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </form>
        {generateError && <p className="mt-3 text-sm text-red-600">{generateError}</p>}
      </div>

      {/* Annual batches */}
      {loadingBatches ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : batches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-sm text-gray-400">No annual 1604-C returns yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-senate-navy text-white">
                <tr>
                  {['Year', 'Status', 'Employees', 'Total Tax Withheld', 'Reference No.', 'Actions'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {batches.map((b, idx) => (
                  <tr key={b.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-semibold text-gray-700">
                      {b.periodStart.substring(0, 4)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status] ?? 'bg-gray-100 text-gray-500'}`}
                      >
                        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{b.employeeCount}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-gray-900">
                      {fmt(b.totalAmount)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {b.referenceNo ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleExportAlphalist(b.id)}
                          disabled={exportingId === b.id}
                          className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
                        >
                          {exportingId === b.id ? 'Exporting…' : 'Export Alphalist CSV'}
                        </button>
                        {b.status === 'generated' && (
                          <button
                            onClick={() => setFiledBatch(b)}
                            className="text-xs font-semibold text-senate-navy hover:underline"
                          >
                            Mark Filed
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mark Filed Modal */}
      {filedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-base font-semibold text-senate-navy">
              Mark 1604-C as Filed — Year {filedBatch.periodStart.substring(0, 4)}
            </h3>
            <form onSubmit={handleMarkFiled} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  BIR Reference / Confirmation No.
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-senate-navy focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Date Filed
                </label>
                <input
                  type="date"
                  value={filedDate}
                  onChange={(e) => setFiledDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-senate-navy focus:outline-none"
                  required
                />
              </div>
              {filingError && <p className="text-sm text-red-600">{filingError}</p>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={filingLoading}
                  className="flex-1 rounded-lg bg-senate-navy py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {filingLoading ? 'Saving…' : 'Confirm Filing'}
                </button>
                <button
                  type="button"
                  onClick={() => setFiledBatch(null)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
