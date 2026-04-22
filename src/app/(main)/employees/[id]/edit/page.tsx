import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { getEmployee } from "@/lib/actions/pimm/employees";
import { EmployeeEditForm } from "@/components/pimm/employee-edit-form";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Edit Employee | PCSO HRS",
  description: "Edit employee 201 file information",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEmployeePage({ params }: PageProps) {
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
        title={`Edit Employee: ${employee.firstName} ${employee.lastName}`}
        description={`Employee No: ${employee.employeeNo}`}
      />
      <EmployeeEditForm employee={employee} />
    </div>
  );
}
