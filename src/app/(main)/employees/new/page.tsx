import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { EmployeeCreateForm } from "@/components/pimm/employee-create-form";

export const metadata = {
  title: "New Employee | PCSO HRS",
  description: "Create new employee 201 file",
};

export default async function NewEmployeePage() {
  await requireAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create New Employee"
        description="Enter all employee information for 201 file creation (PIM-001)"
      />
      <EmployeeCreateForm />
    </div>
  );
}
