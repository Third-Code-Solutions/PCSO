'use client';

import type { RetirementEligibilityType } from '@/lib/utils/remittances/retirement-eligibility';
import type { EmployeeRetirementSummary } from '@/lib/utils/remittances/retirement-eligibility';

// ─── Eligibility badge ────────────────────────────────────────────────────────

const ELIGIBILITY_STYLES: Record<RetirementEligibilityType, string> = {
  not_eligible: 'bg-zinc-100 text-zinc-500',
  optional:     'bg-blue-50 text-blue-700 border border-blue-200',
  compulsory:   'bg-red-50 text-red-700 border border-red-200',
};

const ELIGIBILITY_LABELS: Record<RetirementEligibilityType, string> = {
  not_eligible: 'Not Eligible',
  optional:     'Optional',
  compulsory:   'Compulsory',
};

function EligibilityBadge({ type }: { type: RetirementEligibilityType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ELIGIBILITY_STYLES[type]}`}
    >
      {ELIGIBILITY_LABELS[type]}
    </span>
  );
}

// ─── Money formatter ──────────────────────────────────────────────────────────

function formatMoney(value: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMilestone(
  milestone: EmployeeRetirementSummary['result']['nextMilestone'],
): string {
  if (!milestone) return '—';
  const parts: string[] = [];
  if (milestone.yearsRemaining > 0) parts.push(`${milestone.yearsRemaining}y`);
  if (milestone.monthsRemaining > 0) parts.push(`${milestone.monthsRemaining}mo`);
  const timeStr = parts.length > 0 ? parts.join(' ') : 'soon';
  return `${timeStr} (${milestone.estimatedYear})`;
}

// ─── Approaching indicator ────────────────────────────────────────────────────

function ApproachingIndicator({ summary }: { summary: EmployeeRetirementSummary }) {
  const { result } = summary;
  if (result.eligibilityType !== 'not_eligible') return null;
  if (!result.nextMilestone) return null;

  const totalMonths =
    result.nextMilestone.yearsRemaining * 12 + result.nextMilestone.monthsRemaining;

  if (totalMonths > 24) return null;

  const urgency = totalMonths <= 6 ? 'text-red-600' : 'text-amber-600';
  return (
    <span
      title="Approaching retirement threshold"
      className={`ml-1 inline-block h-2 w-2 rounded-full ${urgency === 'text-red-600' ? 'bg-red-400' : 'bg-amber-400'}`}
      aria-label="Approaching retirement threshold"
    />
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

interface RetirementEligibilityTableProps {
  summaries: EmployeeRetirementSummary[];
}

export function RetirementEligibilityTable({ summaries }: RetirementEligibilityTableProps) {
  if (summaries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-14 text-center">
        <p className="text-sm font-medium text-zinc-500">No employees found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <th className="px-4 py-3">Employee No.</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3 text-right">Age</th>
            <th className="px-4 py-3 text-right">Yrs. Service</th>
            <th className="px-4 py-3">Eligibility</th>
            <th className="px-4 py-3">Next Milestone</th>
            <th className="px-4 py-3 text-right">Est. Monthly Pension</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {summaries.map(({ input, result }) => (
            <tr
              key={input.employeeId}
              className={`transition-colors hover:bg-zinc-50 ${
                result.eligibilityType === 'compulsory'
                  ? 'bg-red-50/30'
                  : result.eligibilityType === 'optional'
                    ? 'bg-blue-50/20'
                    : ''
              }`}
            >
              <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                {input.employeeNo}
              </td>
              <td className="px-4 py-3 font-medium text-zinc-900">
                {input.name}
                <ApproachingIndicator summary={{ input, result }} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                {result.ageYears}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                {result.yearsOfService}
              </td>
              <td className="px-4 py-3">
                <EligibilityBadge type={result.eligibilityType} />
              </td>
              <td className="px-4 py-3 text-xs text-zinc-500">
                {result.eligibilityType !== 'not_eligible'
                  ? '—'
                  : result.nextMilestone
                    ? (
                      <span title={result.nextMilestone.description}>
                        {formatMilestone(result.nextMilestone)}
                      </span>
                    )
                    : '—'}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {result.estimatedMonthlyPension != null ? (
                  <span className="font-semibold text-zinc-900">
                    {formatMoney(result.estimatedMonthlyPension)}
                  </span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
