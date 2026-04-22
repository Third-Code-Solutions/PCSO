import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layouts/page-header";
import { EditPlantillaForm } from "./_form-client";
import { getPlantillaPositionById, getOffices } from "../../queries";
import { requirePermission } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Edit Plantilla Position",
};

interface EditPlantillaPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPlantillaPage({
  params,
}: EditPlantillaPageProps) {
  await requirePermission("plantilla", "edit");
  const { id } = await params;

  const [position, offices] = await Promise.all([
    getPlantillaPositionById(id),
    getOffices(),
  ]);

  if (!position) notFound();

  const officeOptions = offices.map((o) => ({
    id: o.id,
    name: o.name,
    code: o.code,
  }));

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Edit Plantilla Position"
        description={`Editing ${position.positionTitle} (${position.itemNo})`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Plantilla", href: "/plantilla" },
          { label: "Edit Position" },
        ]}
      />

      <EditPlantillaForm
        positionId={id}
        defaultValues={{
          id: position.id,
          itemNo: position.itemNo,
          positionTitle: position.positionTitle,
          salaryGrade: position.salaryGrade,
          authorizedSalary: position.authorizedSalary,
          officeId: position.officeId,
          isFilled: position.isFilled,
          employeeId: position.employeeId,
        }}
        offices={officeOptions}
      />
    </div>
  );
}
