import { PageHeader } from "@/components/layouts/page-header";
import { PeriodForm } from "@/components/payroll/period-form";
import { requirePermission } from "@/lib/auth/guards";
import type { CreatePeriodInput } from "@/lib/validations/payroll";

export const metadata = { title: "New Payroll Period" };

const VALID_SCOPES: CreatePeriodInput["scope"][] = [
  "regular",
  "jo_cos",
  "rata",
  "cash_advance",
  "benefits_bonuses",
  "salary_differential",
  "special",
  "magna_carta",
];

function resolveScope(raw: string | undefined): CreatePeriodInput["scope"] {
  if (raw && (VALID_SCOPES as string[]).includes(raw)) {
    return raw as CreatePeriodInput["scope"];
  }
  return "regular";
}

interface PageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function NewPayrollPeriodPage({
  searchParams,
}: PageProps) {
  await requirePermission("payroll", "create");

  const params = await searchParams;
  const defaultScope = resolveScope(params.type);

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New Payroll Period"
        description="Define the coverage dates, pay date, and scope for this payroll run."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "New Period" },
        ]}
      />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <PeriodForm defaultScope={defaultScope} />
      </div>
    </main>
  );
}
