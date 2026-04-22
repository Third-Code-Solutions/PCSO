import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { EmployeeForm } from "@/components/employees/employee-form";
import { getOfficesForSelect } from "../queries";
import { requirePermission } from "@/lib/auth/guards";

export const metadata = {
  title: "Add Employee",
  description: "Onboard a new PCSO employee.",
};

export default async function NewEmployeePage() {
  await requirePermission("employees", "create");
  const offices = await getOfficesForSelect();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Back navigation */}
      <nav aria-label="Breadcrumb">
        <Link
          href="/employees"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-pcso-navy"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Employees
        </Link>
      </nav>

      {/* Page header */}
      <header>
        <h1 className="font-serif text-2xl font-bold text-pcso-navy">
          Add New Employee
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete all required fields across each tab. Documents can be
          uploaded after saving the employee record.
        </p>
      </header>

      <EmployeeForm mode="create" offices={offices} />
    </div>
  );
}
