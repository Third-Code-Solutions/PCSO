import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { getEmployee } from "@/lib/actions/pimm/employees";
import { EmployeeDocumentRequestList } from "@/components/pimm/employee-document-request-list";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Document Requests | PCSO HRS",
  description: "Employee document request tracking",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentRequestsPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;

  const result = await getEmployee({ id });
  if ("error" in result) {
    notFound();
  }

  const employee = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Document Requests: ${employee.firstName} ${employee.lastName}`}
        description="Track document request lifecycle (PIM-005)"
      />
      <EmployeeDocumentRequestList employeeId={id} />
    </div>
  );
}
