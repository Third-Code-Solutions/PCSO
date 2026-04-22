import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankFileConfigs } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { BankConfigForm } from "../../_components/bank-config-form";
import type { CreateBankConfigInput } from "@/lib/validations/payroll";

export const metadata: Metadata = { title: "Edit Bank Configuration" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBankConfigPage({ params }: PageProps) {
  await requirePermission("payroll", "edit");

  const { id } = await params;

  const [config] = await db
    .select()
    .from(bankFileConfigs)
    .where(and(eq(bankFileConfigs.id, id), isNull(bankFileConfigs.deletedAt)))
    .limit(1);

  if (!config) {
    notFound();
  }

  const defaultValues: Partial<CreateBankConfigInput> = {
    bankName: config.bankName,
    columnMapping: config.columnMapping as Record<string, number>,
    delimiter: config.delimiter,
    hasHeader: config.hasHeader,
    dateFormat: config.dateFormat,
    notes: config.notes ?? undefined,
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Edit Bank Configuration"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Bank Configurations", href: "/payroll/bank-configs" },
          { label: "Edit Configuration" },
        ]}
      />

      <BankConfigForm defaultValues={defaultValues} configId={config.id} />
    </div>
  );
}
