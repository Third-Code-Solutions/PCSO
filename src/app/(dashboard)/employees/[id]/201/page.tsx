import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { getEmployeeById, getOfficesForSelect } from "../../queries";
import {
  listFamilyMembers,
  listEducationRecords,
  listEligibilities,
  listWorkExperiences,
  listVoluntaryWorks,
  listExternalTrainings,
  listDesignations,
} from "@/lib/actions/pimm/employee-201";
import { Profile201Sections } from "@/components/employees/profile-201-sections";
import { PdsProfileCard } from "@/components/employees/profile-201-pds-card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getEmployeeById(id);
  if (!employee) return { title: "Employee Not Found" };
  return {
    title: `${employee.firstName} ${employee.lastName} — 201 File / PDS Data`,
  };
}

/** Unwrap a `{ data } | { error }` action result, falling back on error. */
function unwrap<T>(result: { data: T } | { error: string }, fallback: T): T {
  return "data" in result ? result.data : fallback;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Employee201Page({ params }: PageProps) {
  const { id } = await params;
  const user = await requirePermission("employees", "view");
  const employee = await getEmployeeById(id);
  if (!employee) notFound();

  const canEdit = hasPermission(user.role, "employees", "edit");

  const [
    family,
    education,
    eligibilities,
    workExperiences,
    voluntaryWorks,
    externalTrainings,
    designations,
    offices,
  ] = await Promise.all([
    listFamilyMembers({ employeeId: id }),
    listEducationRecords({ employeeId: id }),
    listEligibilities({ employeeId: id }),
    listWorkExperiences({ employeeId: id }),
    listVoluntaryWorks({ employeeId: id }),
    listExternalTrainings({ employeeId: id }),
    listDesignations({ employeeId: id }),
    getOfficesForSelect(),
  ]);

  const fullName = [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");
  const displayName = employee.suffix
    ? `${fullName}, ${employee.suffix}`
    : fullName;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <Link
          href={`/employees/${employee.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-pcso-navy"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Profile
        </Link>
      </nav>

      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl font-bold text-pcso-navy">
          201 File / PDS Data
        </h1>
        <p className="text-sm text-muted-foreground">
          {displayName} ·{" "}
          <span className="font-mono text-xs">{employee.employeeNo}</span> — CS
          Form 212 backing data used by the PDS generator and qualification
          reports.
        </p>
      </div>

      {/* Section I extras + page-4 data stored on the employees row */}
      <PdsProfileCard
        employeeId={employee.id}
        canEdit={canEdit}
        profile={{
          placeOfBirth: employee.placeOfBirth,
          heightM: employee.heightM,
          weightKg: employee.weightKg,
          sssNo: employee.sssNo,
          telephoneNo: employee.telephoneNo,
          permanentAddressStreet: employee.permanentAddressStreet,
          permanentAddressBarangay: employee.permanentAddressBarangay,
          permanentAddressCity: employee.permanentAddressCity,
          permanentAddressProvince: employee.permanentAddressProvince,
          permanentAddressZipCode: employee.permanentAddressZipCode,
          dualCitizenshipType: employee.dualCitizenshipType,
          dualCitizenshipCountry: employee.dualCitizenshipCountry,
          governmentIssuedId: employee.governmentIssuedId,
          pdsQuestionnaire: employee.pdsQuestionnaire,
          nonAcademicDistinctions: employee.nonAcademicDistinctions,
          organizationMemberships: employee.organizationMemberships,
        }}
      />

      {/* Child-table sections */}
      <Profile201Sections
        employeeId={employee.id}
        canEdit={canEdit}
        offices={offices}
        data={{
          familyMembers: unwrap(family, []),
          education: unwrap(education, []),
          eligibilities: unwrap(eligibilities, []),
          workExperiences: unwrap(workExperiences, []),
          voluntaryWorks: unwrap(voluntaryWorks, []),
          externalTrainings: unwrap(externalTrainings, []),
          designations: unwrap(designations, []),
        }}
      />
    </div>
  );
}
