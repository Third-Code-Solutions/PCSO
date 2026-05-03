import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { getRegisterData } from "../../queries";
import { RegisterDownloadWrapper } from "./_components/register-download-wrapper";

interface Props {
  params: Promise<{ periodId: string }>;
}

export const metadata = { title: "Payroll Register" };

export default async function RegisterPage({ params }: Props) {
  const { periodId } = await params;
  await requirePermission("payroll", "export");

  const data = await getRegisterData(periodId);
  if (!data) notFound();

  const { period, records } = data;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Payroll Register"
        description={`Summary of all ${records.length} employee records for ${period.name}.`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: period.name, href: `/payroll/${periodId}` },
          { label: "Register" },
        ]}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/payroll/${periodId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Period
            </Link>
          </Button>
        }
      />

      <Card className="border-[#0B2545]/10">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <FileBarChart className="mb-4 h-16 w-16 text-[#0B2545]/30" />
          <h2 className="text-lg font-semibold text-[#0B2545]">
            Download Payroll Register
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            The payroll register is a comprehensive summary of all employee
            payroll records for this period, formatted for COA audit submission.
          </p>
          <div className="mt-6">
            <RegisterDownloadWrapper period={period} records={records} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            PDF is generated in your browser · {records.length} record
            {records.length !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
