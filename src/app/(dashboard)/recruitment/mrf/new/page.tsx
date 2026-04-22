import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layouts/page-header";
import { MrfForm } from "@/components/recruitment/mrf-form";
import { requireAuth } from "@/lib/auth/guards";
import {
  getOffices,
  getPlantillaPositions,
} from "@/app/(dashboard)/plantilla/queries";
import { createMrf } from "@/lib/actions/rpm/mrf";
import type { Role } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "New MRF",
};

// Per PRD §11: Supervisor (Dept Head) may create MRFs for their own unit.
// `leave_approver` is the legacy DB value for the `supervisor` role and is
// expanded via `effectiveRolesOf()` at permission-check time.
const ALLOWED_ROLES: ReadonlyArray<Role> = [
  "super_admin",
  "hr_admin",
  "leave_approver",
  "supervisor",
];

export default async function NewMrfPage() {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) redirect("/recruitment/mrf");

  const [offices, plantillaResult] = await Promise.all([
    getOffices(),
    getPlantillaPositions({ page: 1, perPage: 200, status: "vacant" }),
  ]);

  const positions = plantillaResult.rows.map((row) => ({
    id: row.id,
    itemNumber: row.itemNo,
    title: row.positionTitle,
  }));

  const requesterEmployeeId = user.employeeId ?? "";

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New Manpower Request"
        description="Request approval to recruit for a vacant plantilla position."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "MRFs", href: "/recruitment/mrf" },
          { label: "New" },
        ]}
      />
      <MrfForm
        offices={offices.map((o) => ({ id: o.id, name: o.name, code: o.code }))}
        positions={positions}
        requesterEmployeeId={requesterEmployeeId}
        action={createMrf}
      />
    </div>
  );
}
