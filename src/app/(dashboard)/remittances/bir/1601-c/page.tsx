/**
 * BIR Form 1601-C — Monthly Remittance List Page
 * Shows all monthly withholding tax batches and allows generation of new ones.
 */

'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layouts/page-header';
import {
  getBir1601CBatches,
  generateBir1601CBatch,
  markBir1601CFiled,
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

export default function Bir1601CPage() {
  const [batches, setBatches] = React.useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = React.useState(true);

  // Generate form state
  const [yearMonth, setYearMonth] = React.useState('');
  const [remarks, setRemarks] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const [generateError, setGenerateError] = React.useState<string | null>(null);

  // Mark filed state
  const [filedBatch, setFiledBatch] = React.useState<Batch | null>(null);
  const [referenceNo, setReferenceNo] = React.useState('');
  const [filedDate, setFiledDate] = React.useState('');
  const [taxDue, setTaxDue] = React.useState('');
  const [taxPaid, setTaxPaid] = React.useState('');
  const [filingLoading, setFilingLoading] = React.useState(false);
  const [filingError, setFilingError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getBir1601CBatches({ page: 1, perPage: 36 })
      .then(setBatches)
      .finally(() => setLoadingBatches(false));
  }, []);

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGenerateError(null);
    setGenerating(true);
    try {
      const batch = await generateBir1601CBatch({ yearMonth, remarks: remarks || undefined });
      setBatches((prev) => [batch, ...prev]);
      setYearMonth('');
      setRemarks('');
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate batch.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleMarkFiled(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!filedBatch) return;
    setFilingError(null);
    setFilingLoading(true);
    try {
      await markBir1601CFiled({
        batchId: filedBatch.id,
        referenceNo,
        filedDate,
        taxDue,
        taxPaid,
      });
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
        title="BIR Form 1601-C"
        description="Monthly Remittance Return of Income Taxes Withheld on Compensation"
        backHref="/remittances/bir"
      />

      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <strong>Deadline:</strong> Filed on or before the 10th day of the month following the
        taxable month. Late filing subjects the taxpayer to surcharge, interest, and compromise
        penalty under Sections 248–250, NIRC.
      </div>

      {/* Generate form */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-senate-navy">
          Generate New 1601-C Batch
        </h3>
        <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Month (YYYY-MM)
            </label>
            <input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-senate-navy focus:outline-none"
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
        {generateError && (
          <p className="mt-3 text-sm text-red-600">{generateError}</p>
        )}
      </div>

      {/* Batches table */}
      {loadingBatches ? (
        <p className="text-sm text-gray-400">Loading batches…</p>
      ) : batches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-sm text-gray-400">No 1601-C batches yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-senate-navy text-white">
                <tr>
                  {['Period', 'Status', 'Employees', 'Total Tax Withheld', 'Reference No.', 'Created', ''].map(
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
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">
                      {b.periodStart.substring(0, 7)}
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
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {b.createdAt.toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {b.status === 'generated' && (
                        <button
                          onClick={() => {
                            setFiledBatch(b);
                            setTaxDue(b.totalAmount);
                            setTaxPaid(b.totalAmount);
                          }}
                          className="text-xs font-semibold text-senate-navy hover:underline"
                        >
                          Mark Filed
                        </button>
                      )}
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
              Mark 1601-C as Filed — {filedBatch.periodStart.substring(0, 7)}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Tax Due
                  </label>
                  <input
                    type="text"
                    value={taxDue}
                    onChange={(e) => setTaxDue(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-senate-navy focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Tax Paid
                  </label>
                  <input
                    type="text"
                    value={taxPaid}
                    onChange={(e) => setTaxPaid(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-senate-navy focus:outline-none"
                    required
                  />
                </div>
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
