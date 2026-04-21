import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { bankFileConfigs } from "@/lib/db/schema";
import { isNull, desc } from "drizzle-orm";
import { BankConfigTable } from "./_components/bank-config-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

export const metadata = { title: "Bank File Configurations" };

export default async function BankConfigsPage() {
  await requirePermission("payroll", "read");

  // Fetch all bank configurations
  const configs = await db
    .select()
    .from(bankFileConfigs)
    .where(isNull(bankFileConfigs.deletedAt))
    .orderBy(desc(bankFileConfigs.createdAt));

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Bank File Configurations"
        description="Configure CSV column mappings for bank hash file generation per bank."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Bank Configs" },
        ]}
      >
        <Link href="/payroll/bank-configs/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Configuration
          </Button>
        </Link>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <BankConfigTable configs={configs} />
      </div>
    </main>
  );
}
