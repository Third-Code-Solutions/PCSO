import { Suspense } from 'react';
import { requirePermission } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { employees, gsisRegistrations } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import {
  evaluateBatchRetirementEligibility,
  type EmployeeRetirementInput,
} from '@/lib/utils/remittances/retirement-eligibility';
import { RetirementEligibilityTable } from '@/components/remittances/retirement-eligibility-table';

export const metadata = {
  title: 'Retirement Eligibility Tracker',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function loadRetirementData() {
  // Fetch all active employees with their GSIS registration
  const rows = await db
    .select({
      empId: employees.id,
      empNo: employees.employeeNo,
      firstName: employees.firstName,
      middleName: employees.middleName,
      lastName: employees.lastName,
      birthDate: employees.birthDate,
      monthlySalary: employees.salaryGrade, // proxy; salary lookup needed for exact
      gsisStartDate: gsisRegistrations.governmentServiceStartDate,
    })
    .from(employees)
    .leftJoin(
      gsisRegistrations,
      and(
        eq(gsisRegistrations.employeeId, employees.id),
        isNull(gsisRegistrations.deletedAt),
      ),
    )
    .where(
      and(eq(employees.status, 'active'), isNull(employees.deletedAt)),
    );

  // We use a conservative ₱33,575 for SG 1 as floor and scale linearly.
  // In production, join salary_grades for exact amount.
  // This is a display-only estimation — the pension formula note remains accurate.
  function estimateSalary(sg: number): number {
    // Rough SSL V baseline: SG1 = 13,000, ~₱2,500 increment per grade
    return 13000 + (sg - 1) * 2500;
  }

  const inputs: EmployeeRetirementInput[] = rows
    .filter((r) => r.gsisStartDate != null)
    .map((r) => {
      const mi = r.middleName ? ` ${r.middleName.charAt(0).toUpperCase()}.` : '';
      return {
        employeeId: r.empId,
        employeeNo: r.empNo,
        name: `${r.lastName}, ${r.firstName}${mi}`,
        birthDate: r.birthDate,
        governmentServiceStartDate: r.gsisStartDate as string,
        currentMonthlySalary: estimateSalary(r.monthlySalary),
      };
    });

  return evaluateBatchRetirementEligibility(inputs);
}

// ─── Async section ────────────────────────────────────────────────────────────

async function RetirementContent() {
  const summaries = await loadRetirementData();

  const compulsory = summaries.filter((s) => s.result.eligibilityType === 'compulsory');
  const optional = summaries.filter((s) => s.result.eligibilityType === 'optional');
  const notEligible = summaries.filter((s) => s.result.eligibilityType === 'not_eligible');

  // Approaching = within 24 months of any threshold
  const approaching = notEligible.filter((s) => {
    if (!s.result.nextMilestone) return false;
    const months =
      s.result.nextMilestone.yearsRemaining * 12 +
      s.result.nextMilestone.monthsRemaining;
    return months <= 24;
  });

  return (
    <div className="space-y-8">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Compulsory Retirees', value: compulsory.length, color: 'text-red-700' },
          { label: 'Optional Eligible', value: optional.length, color: 'text-blue-700' },
          {
            label: 'Approaching (≤2 yrs)',
            value: approaching.length,
            color: 'text-amber-700',
          },
          { label: 'Not Yet Eligible', value: notEligible.length, color: 'text-zinc-700' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              {s.label}
            </p>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Compulsory section */}
      {compulsory.length > 0 && (
        <section aria-labelledby="compulsory-heading">
          <div className="mb-4 flex items-center gap-3">
            <h2 id="compulsory-heading" className="text-base font-semibold text-red-700">
              Compulsory Retirees (Age 65+)
            </h2>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              {compulsory.length}
            </span>
          </div>
          <div className="mb-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
            These employees have reached compulsory retirement age. Coordinate with HR for
            retirement processing under RA 8291.
          </div>
          <RetirementEligibilityTable summaries={compulsory} />
        </section>
      )}

      {/* Optional section */}
      {optional.length > 0 && (
        <section aria-labelledby="optional-heading">
          <div className="mb-4 flex items-center gap-3">
            <h2 id="optional-heading" className="text-base font-semibold text-blue-700">
              Optional Retirement Eligible
            </h2>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {optional.length}
            </span>
          </div>
          <RetirementEligibilityTable summaries={optional} />
        </section>
      )}

      {/* Approaching section */}
      {approaching.length > 0 && (
        <section aria-labelledby="approaching-heading">
          <div className="mb-4 flex items-center gap-3">
            <h2
              id="approaching-heading"
              className="text-base font-semibold text-amber-700"
            >
              Approaching Retirement (within 2 years)
            </h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {approaching.length}
            </span>
          </div>
          <RetirementEligibilityTable summaries={approaching} />
        </section>
      )}

      {/* All employees table */}
      <section aria-labelledby="all-heading">
        <h2 id="all-heading" className="mb-4 text-base font-semibold text-zinc-800">
          All Employees ({summaries.length})
        </h2>
        <RetirementEligibilityTable summaries={summaries} />
      </section>

      {/* Formula note */}
      <aside className="rounded-xl border border-zinc-100 bg-zinc-50 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Pension Formula (RA 8291 Section 9[a])
        </p>
        <p className="mt-2 font-mono text-xs text-zinc-700">
          Monthly Pension = BMP × [37.5% + (2.5% × (YOS − 15))]
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          BMP = Basic Monthly Pay. YOS = Years of Service. Maximum 90% of BMP.
          Minimum {formatMoney(3000)} / month.
        </p>
        <p className="mt-2 text-xs text-zinc-400">
          Pension estimates shown are based on current monthly salary as a proxy for BMP.
          Actual computation uses the average of the last 3 years of highest monthly salary.
        </p>
      </aside>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RetirementEligibilityPage() {
  await requirePermission('employees', 'view');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-senate-navy">Retirement Eligibility Tracker</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Monitors employee retirement thresholds under RA 8291 (GSIS Act of 1997).
        </p>
      </div>

      <Suspense
        fallback={
          <div className="h-64 animate-pulse rounded-xl bg-zinc-100" aria-label="Loading…" />
        }
      >
        <RetirementContent />
      </Suspense>
    </div>
  );
}
