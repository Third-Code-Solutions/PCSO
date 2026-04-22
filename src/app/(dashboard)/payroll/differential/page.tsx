import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/guards";

export const metadata = { title: "Salary Differential Payroll" };

export default async function DifferentialPayrollPage() {
  await requirePermission("payroll", "view");

  return (
    <main className="space-y-8">
      <PageHeader
        title="Salary Differential Payroll"
        description="Retroactive pay adjustments per PAY-006."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Differential" },
        ]}
        actions={
          <Button
            size="sm"
            asChild
            className="bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            <Link href="/payroll/differential/new">
              <Plus className="mr-2 h-4 w-4" />
              New Differential Run
            </Link>
          </Button>
        }
      />
    </main>
  );
}
