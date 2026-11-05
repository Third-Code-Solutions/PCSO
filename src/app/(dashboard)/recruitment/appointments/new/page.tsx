/**
 * /recruitment/appointments/new — Create new appointment from selected applicant.
 */

import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { NewAppointmentForm } from "@/components/recruitment/new-appointment-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New Appointment" };

interface NewAppointmentPageProps {
  searchParams: Promise<{ applicationId?: string }>;
}

export default async function NewAppointmentPage({
  searchParams,
}: NewAppointmentPageProps) {
  await requirePermission("employees", "create");
  const { applicationId } = await searchParams;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <PageHeader
        title="New Appointment"
        description="Issue CSC appointment from qualified applicant"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "Appointments", href: "/recruitment/appointments" },
          { label: "New" },
        ]}
      />

      <div className="mt-6">
        <NewAppointmentForm defaultApplicationId={applicationId ?? ""} />
      </div>
    </main>
  );
}
