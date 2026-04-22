/**
 * /recruitment/appointments/[id]/provision — Dedicated provisioning page (RPM-023)
 * Auto-provision employee across modules with preview and confirmation.
 */

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { getAppointment } from "@/lib/actions/recruitment-appointments";
import { AppointmentProvisionWizard } from "@/components/recruitment/appointment-provision-wizard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Provision Employee",
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProvisionPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;

  const appointment = await getAppointment(id);

  if (!appointment.success || !appointment.data) {
    redirect("/recruitment/appointments");
  }

  const apt = appointment.data;

  // If already provisioned, redirect to detail page
  if (apt.provisioned) {
    redirect(`/recruitment/appointments/${id}`);
  }

  // If documents not generated, redirect to detail to generate first
  if (!apt.generatedDocuments || apt.status !== "ready_for_provisioning") {
    redirect(`/recruitment/appointments/${id}`);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader
        title="Provision Employee"
        description="Auto-provision employee record across all modules"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "Appointments", href: "/recruitment/appointments" },
          {
            label: apt.appointmentNumber || "Appointment",
            href: `/recruitment/appointments/${id}`,
          },
          { label: "Provision" },
        ]}
      />

      <div className="mt-6">
        <AppointmentProvisionWizard appointment={apt} />
      </div>
    </main>
  );
}
