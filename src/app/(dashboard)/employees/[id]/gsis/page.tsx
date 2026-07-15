import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { maskGsis } from "@/lib/utils/masking";
import { db } from "@/lib/db";
import {
  employees,
  gsisRegistrations,
  gsisLoans,
  payrollRecords,
} from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import {
  evaluateRetirementEligibility,
  type EmployeeRetirementInput,
} from "@/lib/utils/remittances/retirement-eligibility";
import { GsisRegistrationForm } from "@/components/employees/gsis-registration-form";
import type { GsisRegistration, GsisLoan } from "@/lib/db/schema/gsis";

export const metadata = {
  title: "GSIS Details",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value: string | number | null | undefined): string {
  if (value == null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2.5">
      <dt className="w-48 shrink-0 text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd className="text-sm text-zinc-900">{value}</dd>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

// ─── Registration section ─────────────────────────────────────────────────────

function RegistrationSection({
  registration,
  employeeId,
  canViewFullIds,
}: {
  registration: GsisRegistration | null;
  employeeId: string;
  /** TOR 3.2.8: viewers without employees.edit see a masked GSIS number. */
  canViewFullIds: boolean;
}) {
  return (
    <SectionCard title="GSIS Membership">
      {registration ? (
        <dl className="divide-y divide-zinc-50">
          <InfoRow
            label="GSIS No."
            value={
              <span className="font-mono">
                {canViewFullIds
                  ? registration.gsisNo
                  : maskGsis(registration.gsisNo)}
              </span>
            }
          />
          <InfoRow label="Status" value={registration.status} />
          <InfoRow
            label="Govt. Service Start"
            value={formatDate(registration.governmentServiceStartDate)}
          />
          <InfoRow
            label="Registered Date"
            value={formatDate(registration.registeredDate)}
          />
          <InfoRow
            label="Compulsory Member"
            value={registration.isCompulsory ? "Yes" : "No"}
          />
          <InfoRow
            label="Enrolled in RF"
            value={registration.enrolledInRetirementFund ? "Yes" : "No"}
          />
          {registration.notes && (
            <InfoRow label="Notes" value={registration.notes} />
          )}
        </dl>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            No GSIS registration on file. Complete the form below to register.
          </div>
          <GsisRegistrationForm employeeId={employeeId} />
        </div>
      )}
    </SectionCard>
  );
}

// ─── Loans section ────────────────────────────────────────────────────────────

function LoansSection({ loans }: { loans: GsisLoan[] }) {
  const LOAN_TYPE_LABELS: Record<string, string> = {
    policy_loan: "Policy Loan",
    emergency_loan: "Emergency Loan",
    consolidated_loan: "Consolidated Loan",
    housing_loan: "Housing Loan",
    educational_loan: "Educational Loan",
    calamity_loan: "Calamity Loan",
    restructured_loan: "Restructured Loan",
  };

  return (
    <SectionCard title="GSIS Loans">
      {loans.length === 0 ? (
        <p className="text-sm text-zinc-400">No GSIS loan records on file.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4">Ref. No.</th>
                <th className="pb-3 pr-4 text-right">Principal</th>
                <th className="pb-3 pr-4 text-right">Monthly Amort.</th>
                <th className="pb-3 pr-4 text-right">Outstanding</th>
                <th className="pb-3 pr-4">Loan Date</th>
                <th className="pb-3">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {loans.map((loan) => (
                <tr key={loan.id}>
                  <td className="py-2 pr-4 font-medium">
                    {LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-zinc-500">
                    {loan.loanReferenceNo}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatMoney(loan.principalAmount)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatMoney(loan.monthlyAmortization)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums font-semibold">
                    {formatMoney(loan.outstandingBalance)}
                  </td>
                  <td className="py-2 pr-4 text-xs text-zinc-500">
                    {formatDate(loan.loanDate)}
                  </td>
                  <td className="py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        loan.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {loan.isActive ? "Active" : "Closed"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Contributions history section ────────────────────────────────────────────

interface ContributionRow {
  id: string;
  periodId: string;
  authorizedSalary: string;
  gsisPersonal: string;
  gsisEmployer: string;
  gsisLifeInsurance: string;
  createdAt: Date;
}

function ContributionsSection({
  contributions,
}: {
  contributions: ContributionRow[];
}) {
  return (
    <SectionCard title="Recent GSIS Contributions (last 24 records)">
      {contributions.length === 0 ? (
        <p className="text-sm text-zinc-400">No contribution records found.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <th className="pb-3 pr-4">Period</th>
                <th className="pb-3 pr-4 text-right">Monthly Salary Credit</th>
                <th className="pb-3 pr-4 text-right">Personal Share</th>
                <th className="pb-3 pr-4 text-right">Employer Share</th>
                <th className="pb-3 text-right">Life Insurance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {contributions.map((c) => (
                <tr key={c.id}>
                  <td className="py-2 pr-4 font-mono text-xs text-zinc-500">
                    {new Date(c.createdAt).toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatMoney(c.authorizedSalary)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatMoney(c.gsisPersonal)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatMoney(c.gsisEmployer)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatMoney(c.gsisLifeInsurance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Retirement eligibility section ──────────────────────────────────────────

function RetirementSection({
  employee,
  registration,
}: {
  employee: {
    birthDate: string;
    salaryGrade: number;
  };
  registration: GsisRegistration | null;
}) {
  if (!registration) {
    return (
      <SectionCard title="Retirement Eligibility">
        <p className="text-sm text-zinc-400">
          Register this employee in GSIS to enable retirement eligibility
          tracking.
        </p>
      </SectionCard>
    );
  }

  const input: EmployeeRetirementInput = {
    employeeId: "",
    employeeNo: "",
    name: "",
    birthDate: employee.birthDate,
    governmentServiceStartDate: registration.governmentServiceStartDate,
    currentMonthlySalary: 13000 + (employee.salaryGrade - 1) * 2500,
  };

  const result = evaluateRetirementEligibility(input);

  const ELIGIBILITY_LABELS = {
    not_eligible: "Not Yet Eligible",
    optional: "Optional Retirement Eligible",
    compulsory: "Compulsory Retirement (Age 65)",
  };

  const ELIGIBILITY_COLORS = {
    not_eligible: "bg-zinc-100 text-zinc-600",
    optional: "bg-blue-50 text-blue-700",
    compulsory: "bg-red-50 text-red-700",
  };

  return (
    <SectionCard title="Retirement Eligibility">
      <div className="mb-4">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${ELIGIBILITY_COLORS[result.eligibilityType]}`}
        >
          {ELIGIBILITY_LABELS[result.eligibilityType]}
        </span>
      </div>

      <dl className="divide-y divide-zinc-50">
        <InfoRow label="Age" value={`${result.ageYears} years old`} />
        <InfoRow
          label="Years of Service"
          value={`${result.yearsOfService} years`}
        />
        <InfoRow
          label="Meets Age Req. (≥60)"
          value={result.meetsOptionalAge ? "Yes" : "No"}
        />
        <InfoRow
          label="Meets Service Req. (≥15yr)"
          value={result.meetsMinService ? "Yes" : "No"}
        />
        {result.nextMilestone && (
          <InfoRow
            label="Next Milestone"
            value={
              <span className="text-amber-700">
                {result.nextMilestone.description} —{" "}
                {result.nextMilestone.yearsRemaining > 0
                  ? `${result.nextMilestone.yearsRemaining}yr `
                  : ""}
                {result.nextMilestone.monthsRemaining}mo remaining (est.{" "}
                {result.nextMilestone.estimatedYear})
              </span>
            }
          />
        )}
        {result.estimatedMonthlyPension != null && (
          <InfoRow
            label="Est. Monthly Pension"
            value={
              <span className="font-semibold text-pcso-navy">
                {formatMoney(result.estimatedMonthlyPension)}
              </span>
            }
          />
        )}
        {result.pensionDetail && (
          <>
            <InfoRow
              label="Pension Rate"
              value={`${(result.pensionDetail.pensionRate * 100).toFixed(1)}%`}
            />
            <InfoRow
              label="Gross Monthly Pension"
              value={formatMoney(result.pensionDetail.grossMonthlyPension)}
            />
          </>
        )}
      </dl>

      <p className="mt-4 text-xs text-zinc-400">
        Pension estimate uses current salary as proxy for BMP. Actual
        computation uses average of last 3 years&#39; highest monthly salary per
        RA 8291.
      </p>
    </SectionCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: { id: string };
}

export default async function EmployeeGsisPage({ params }: Props) {
  const user = await requirePermission("employees", "view");
  // TOR 3.2.8: only HR-privileged roles see the full GSIS number on screen.
  const canViewFullIds = hasPermission(user.role, "employees", "edit");

  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, params.id), isNull(employees.deletedAt)))
    .limit(1);

  if (!employee) notFound();

  const [registration] = await db
    .select()
    .from(gsisRegistrations)
    .where(
      and(
        eq(gsisRegistrations.employeeId, params.id),
        isNull(gsisRegistrations.deletedAt),
      ),
    )
    .limit(1);

  const loans = await db
    .select()
    .from(gsisLoans)
    .where(
      and(eq(gsisLoans.employeeId, params.id), isNull(gsisLoans.deletedAt)),
    )
    .orderBy(desc(gsisLoans.createdAt));

  const contributions = await db
    .select({
      id: payrollRecords.id,
      periodId: payrollRecords.periodId,
      authorizedSalary: payrollRecords.authorizedSalary,
      gsisPersonal: payrollRecords.gsisPersonal,
      gsisEmployer: payrollRecords.gsisEmployer,
      gsisLifeInsurance: payrollRecords.gsisLifeInsurance,
      createdAt: payrollRecords.createdAt,
    })
    .from(payrollRecords)
    .where(eq(payrollRecords.employeeId, params.id))
    .orderBy(desc(payrollRecords.createdAt))
    .limit(24);

  const mi = employee.middleName
    ? ` ${employee.middleName.charAt(0).toUpperCase()}.`
    : "";
  const fullName = `${employee.lastName}, ${employee.firstName}${mi}`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Employee &mdash; GSIS Details
        </p>
        <h1 className="mt-1 text-2xl font-bold text-pcso-navy">{fullName}</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          {employee.positionTitle} &middot; Employee No. {employee.employeeNo}
        </p>
      </div>

      {/* Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <RegistrationSection
            registration={registration ?? null}
            employeeId={params.id}
            canViewFullIds={canViewFullIds}
          />
          <LoansSection loans={loans} />
        </div>
        <div className="space-y-6">
          <RetirementSection
            employee={{
              birthDate: employee.birthDate,
              salaryGrade: employee.salaryGrade,
            }}
            registration={registration ?? null}
          />
          <ContributionsSection contributions={contributions} />
        </div>
      </div>
    </div>
  );
}
