import type { Metadata } from "next";
import { PageHeader } from "@/components/layouts/page-header";
import { PlantillaForm } from "@/components/plantilla/plantilla-form";
import { createPlantillaPosition } from "../actions";
import { getOffices } from "../queries";
import { requirePermission } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "New Plantilla Position",
};

export default async function NewPlantillaPage() {
  await requirePermission("plantilla", "create");
  const offices = await getOffices();
  const officeOptions = offices.map((o) => ({
    id: o.id,
    name: o.name,
    code: o.code,
  }));

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New Plantilla Position"
        description="Create a new authorized position in the plantilla of personnel."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Plantilla", href: "/plantilla" },
          { label: "New Position" },
        ]}
      />

      <PlantillaForm offices={officeOptions} action={createPlantillaPosition} />
    </div>
  );
}
