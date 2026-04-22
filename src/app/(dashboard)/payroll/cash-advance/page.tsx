import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { payrollPeriods } from "@/lib/db/schema";
import { eq, isNull, desc, and } from "drizzle-orm";
import { PeriodStatusBadge } from "@/components/payroll/period-status-badge";

export const metadata = { title: "Cash Advance Payroll" };

export default async function CashAdvancePayrollPage() {
  await requirePermission("payroll", "view");

  const periods = await db
    .select()
    .from(payrollPeriods)
    .where(
      and(
        eq(payrollPeriods.scope, "cash_advance"),
        isNull(payrollPeriods.deletedAt),
      ),
    )
    .orderBy(desc(payrollPeriods.createdAt))
    .limit(20);

  return (
    <main className="space-y-8">
      <PageHeader
        title="Cash Advance Payroll"
        description="Cash advance payroll runs per PAY-004. Loan deductions only."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Cash Advance" },
        ]}
        actions={
          <Button
            size="sm"
            asChild
            className="bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            <Link href="/payroll/cash-advance/new">
              <Plus className="mr-2 h-4 w-4" />
              New Cash Advance Run
            </Link>
          </Button>
        }
      />

      {periods.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-20 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold text-foreground">
            No cash advance payroll runs yet
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first cash advance payroll period.
          </p>
        </div>
      )}
    </main>
  );
}
