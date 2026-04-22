import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { getEmployee } from "@/lib/actions/pimm/employees";
import { EmployeeDocumentUploadForm } from "@/components/pimm/employee-document-upload-form";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Upload Document | PCSO HRS",
  description: "Upload employee 201 file document",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UploadDocumentPage({ params }: PageProps) {
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
        title={`Upload Document: ${employee.firstName} ${employee.lastName}`}
        description="Upload scanned documents to 201 file (PIM-004)"
      />
      <EmployeeDocumentUploadForm employeeId={id} />
    </div>
  );
}
