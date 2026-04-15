/**
 * BIR Form 2316 — Year-End Employee Certificate Page
 * Allows HR to generate and download BIR 2316 for individual employees or all employees.
 */

'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layouts/page-header';
import { getBir2316Data } from '../actions';

type EmployeeRow = Awaited<ReturnType<typeof getBir2316Data>>[number];

function fmt(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return '₱0.00';
  return `₱${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export default function Bir2316Page() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = React.useState(String(currentYear - 1));
  const [employeeId, setEmployeeId] = React.useState('');
  const [rows, setRows] = React.useState<EmployeeRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searched, setSearched] = React.useState(false);

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSearched(true);
    try {
      const data = await getBir2316Data({
        year,
        employeeId: employeeId.trim() || undefined,
      });
      setRows(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="BIR Form 2316"
        description="Certificate of Compensation Payment / Tax Withheld — Year-End Employee Certificate"
        backHref="/remittances/bir"
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <strong>Issuance Deadline:</strong> BIR Form 2316 must be issued to each employee on or
        before January 31 of the year following the calendar year covered, or upon cessation of
        employment. Qualified employees with a single employer are substituted from filing ITR.
      </div>

      {/* Search / filter */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-senate-navy">Generate 2316 Data</h3>
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-4">
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
              Employee ID (optional — leave blank for all)
            </label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="UUID or leave blank for all employees"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm focus:border-senate-navy focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-senate-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Load Data'}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {/* Results */}
      {searched && !loading && (
        <>
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
              <p className="text-sm text-gray-400">
                No payroll data found for year {year}.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {rows.length} employee{rows.length !== 1 ? 's' : ''} — Year {year}
                </p>
                <p className="text-xs text-gray-400">
                  PDF generation: use the View action per employee (PDF export coming next).
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-senate-navy text-white">
                      <tr>
                        {[
                          '#',
                          'Name',
                          'TIN',
                          'Gross Compensation',
                          'Non-Taxable',
                          'Taxable',
                          'Tax Withheld',
                          'Status',
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r, idx) => {
                        const taxNum = parseFloat(r.taxWithheld);
                        return (
                          <tr key={r.employeeId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2.5 text-gray-400">{idx + 1}</td>
                            <td className="px-3 py-2.5 font-semibold text-gray-900">
                              {r.lastName.toUpperCase()}, {r.firstName}
                              {r.middleName ? ` ${r.middleName.charAt(0)}.` : ''}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-gray-500">{r.tin || '—'}</td>
                            <td className="px-3 py-2.5 tabular-nums text-gray-700">
                              {fmt(r.grossCompensation)}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-gray-500">
                              {fmt(r.nonTaxableCompensation)}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums font-semibold text-gray-900">
                              {fmt(r.taxableCompensation)}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-gray-700">
                              {fmt(r.taxWithheld)}
                            </td>
                            <td className="px-3 py-2.5">
                              {taxNum === 0 ? (
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">
                                  No tax
                                </span>
                              ) : (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">
                                  Withheld
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary totals */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  {
                    label: 'Total Gross Compensation',
                    value: fmt(rows.reduce((s, r) => s + parseFloat(r.grossCompensation), 0)),
                  },
                  {
                    label: 'Total Non-Taxable',
                    value: fmt(rows.reduce((s, r) => s + parseFloat(r.nonTaxableCompensation), 0)),
                  },
                  {
                    label: 'Total Taxable',
                    value: fmt(rows.reduce((s, r) => s + parseFloat(r.taxableCompensation), 0)),
                  },
                  {
                    label: 'Total Tax Withheld',
                    value: fmt(rows.reduce((s, r) => s + parseFloat(r.taxWithheld), 0)),
                  },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                    <p className="text-xs text-gray-400">{c.label}</p>
                    <p className="mt-1 text-lg font-bold text-senate-navy">{c.value}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
