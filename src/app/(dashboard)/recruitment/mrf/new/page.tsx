import type { Metadata } from "next";
import { PageHeader } from "@/components/layouts/page-header";
import { MrfForm } from "@/components/recruitment/mrf-form";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  getOffices,
  getPlantillaPositions,
} from "@/app/(dashboard)/plantilla/queries";
import { createMrf } from "@/lib/actions/rpm/mrf";

export const metadata: Metadata = {
  title: "New MRF",
};

export default async function NewMrfPage() {
  const [user, offices, plantillaResult] = await Promise.all([
    getCurrentUser(),
    getOffices(),
    getPlantillaPositions({ page: 1, perPage: 200, status: "vacant" }),
  ]);

  const positions = plantillaResult.rows.map((row) => ({
    id: row.id,
    itemNumber: row.itemNo,
    title: row.positionTitle,
  }));

  const requesterEmployeeId = user?.employeeId ?? "";

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
