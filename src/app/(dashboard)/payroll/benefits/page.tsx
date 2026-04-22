import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/guards";

export const metadata = { title: "Benefits & Bonuses Payroll" };

export default async function BenefitsPayrollPage() {
  await requirePermission("payroll", "view");

  return (
    <main className="space-y-8">
      <PageHeader
        title="Benefits & Bonuses Payroll"
        description="Mid-Year, Year-End, Cash Gift, and PBB runs per PAY-005."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Benefits" },
        ]}
        actions={
          <Button
            size="sm"
            asChild
            className="bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            <Link href="/payroll/benefits/new">
              <Plus className="mr-2 h-4 w-4" />
              New Benefit Run
            </Link>
          </Button>
        }
      />
    </main>
  );
}
