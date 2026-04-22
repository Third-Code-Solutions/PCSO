import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/guards";

export const metadata = { title: "Magna Carta Benefits" };

export default async function MagnaCartaPayrollPage() {
  await requirePermission("payroll", "view");

  return (
    <main className="space-y-8">
      <PageHeader
        title="Magna Carta Benefits Payroll"
        description="RA 9710 (Women) and RA 7277 (PWD) benefits per PAY-008."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Magna Carta" },
        ]}
        actions={
          <Button
            size="sm"
            asChild
            className="bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            <Link href="/payroll/magna-carta/new">
              <Plus className="mr-2 h-4 w-4" />
              New Magna Carta Run
            </Link>
          </Button>
        }
      />
    </main>
  );
}
