import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { getEmployee } from "@/lib/actions/pimm/employees";
import { listEmployeeDocuments } from "@/lib/actions/pimm/employee-documents";
import { EmployeeDocumentList } from "@/components/pimm/employee-document-list";
import { notFound } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Employee Documents | PCSO HRS",
  description: "View employee 201 file documents",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployeeDocumentsPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;

  const empResult = await getEmployee({ id });
  if ("error" in empResult) {
    notFound();
  }

  const docsResult = await listEmployeeDocuments({ employeeId: id });
  const documents = "error" in docsResult ? [] : docsResult.data;

  const employee = empResult.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`201 File Documents: ${employee.firstName} ${employee.lastName}`}
        description={`Employee No: ${employee.employeeNo}`}
      />
      <div className="flex justify-end">
        <Link
          href={`/employees/${id}/documents/upload`}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Upload Document
        </Link>
      </div>
      <EmployeeDocumentList documents={documents} employeeId={id} />
    </div>
  );
}
