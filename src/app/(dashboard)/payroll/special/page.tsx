import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/guards";

export const metadata = { title: "Special Payroll" };

export default async function SpecialPayrollPage() {
  await requirePermission("payroll", "view");

  return (
    <main className="space-y-8">
      <PageHeader
        title="Special Payroll"
        description="Custom payroll runs with configurable title per PAY-007."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Special" },
        ]}
        actions={
          <Button
            size="sm"
            asChild
            className="bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            <Link href="/payroll/special/new">
              <Plus className="mr-2 h-4 w-4" />
              New Special Run
            </Link>
          </Button>
        }
      />
    </main>
  );
}
