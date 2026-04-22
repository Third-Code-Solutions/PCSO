import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { EmployeeForm } from "@/components/employees/employee-form";
import { getEmployeeForEdit, getOfficesForSelect } from "../../queries";
import { requirePermission } from "@/lib/auth/guards";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getEmployeeForEdit(id);
  if (!employee) return { title: "Employee Not Found" };
  return {
    title: `Edit — ${employee.firstName} ${employee.lastName}`,
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEmployeePage({ params }: PageProps) {
  await requirePermission("employees", "edit");
  const { id } = await params;

  const [employee, offices] = await Promise.all([
    getEmployeeForEdit(id),
    getOfficesForSelect(),
  ]);

  if (!employee) notFound();

  // Map DB fields back to form shape
  const defaultValues = {
    id: employee.id,
    employeeNo: employee.employeeNo,
    firstName: employee.firstName,
    middleName: employee.middleName ?? undefined,
    lastName: employee.lastName,
    suffix: employee.suffix ?? undefined,
    birthDate: employee.birthDate,
    gender: employee.gender,
    civilStatus: employee.civilStatus,
    nationality: employee.nationality,
    religion: employee.religion ?? undefined,
    bloodType: employee.bloodType ?? undefined,
    email: employee.email ?? "",
    phone: employee.phone ?? "",
    // Map DB address columns back to form's currentAddress fields
    currentAddressStreet: employee.addressStreet ?? undefined,
    currentAddressBarangay: employee.addressBarangay ?? undefined,
    currentAddressCity: employee.addressCity ?? undefined,
    currentAddressProvince: employee.addressProvince ?? undefined,
    currentAddressZip: employee.addressZipCode ?? undefined,
    emergencyContactName: employee.emergencyContactName ?? undefined,
    emergencyContactRelation:
      employee.emergencyContactRelationship ?? undefined,
    emergencyContactPhone: employee.emergencyContactPhone ?? "",
    appointmentType: employee.appointmentType,
    positionTitle: employee.positionTitle,
    salaryGrade: employee.salaryGrade,
    step: employee.step,
    officeId: employee.officeId ?? "",
    dateHired: employee.dateHired,
    dateRegularized: employee.dateRegularized ?? undefined,
    status: employee.status,
    tin: employee.tin ?? "",
    gsisNo: employee.gsisNo ?? "",
    philhealthNo: employee.philhealthNo ?? "",
    pagibigNo: employee.pagibigNo ?? "",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex gap-2 text-sm text-muted-foreground"
      >
        <Link href="/employees" className="hover:text-pcso-navy">
          Employees
        </Link>
        <span>/</span>
        <Link href={`/employees/${id}`} className="hover:text-pcso-navy">
          {employee.firstName} {employee.lastName}
        </Link>
        <span>/</span>
        <span className="text-foreground">Edit</span>
      </nav>

      {/* Back link */}
      <div>
        <Link
          href={`/employees/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-pcso-navy"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Profile
        </Link>
      </div>

      <header>
        <h1 className="font-serif text-2xl font-bold text-pcso-navy">
          Edit Employee — {employee.firstName} {employee.lastName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update fields as needed. All changes are audit-logged.
        </p>
      </header>

      <EmployeeForm
        mode="edit"
        defaultValues={defaultValues}
        offices={offices}
      />
    </div>
  );
}
