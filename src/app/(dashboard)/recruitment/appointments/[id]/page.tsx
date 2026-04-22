/**
 * /recruitment/appointments/[id] — View appointment details + generated docs.
 */

import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAppointment } from "@/lib/actions/recruitment-appointments";
import { AppointmentDetailsCard } from "@/components/recruitment/appointment-details-card";
import { AppointmentDocumentsCard } from "@/components/recruitment/appointment-documents-card";
import { AppointmentProvisionCard } from "@/components/recruitment/appointment-provision-card";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Appointment Details" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AppointmentDetailPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;

  const appointment = await getAppointment(id);

  if (!appointment) {
    notFound();
  }

  const fullName = [
    appointment.applicantFirstName,
    appointment.applicantMiddleName,
    appointment.applicantLastName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title={`Appointment ${appointment.appointmentNumber ?? "Draft"}`}
        description={`CSC appointment for ${fullName}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "Appointments", href: "/recruitment/appointments" },
          { label: appointment.appointmentNumber ?? "Details" },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <AppointmentDetailsCard appointment={appointment} />
          <AppointmentDocumentsCard appointment={appointment} />
        </div>

        <div className="space-y-6">
          <AppointmentProvisionCard appointment={appointment} />
        </div>
      </div>
    </main>
  );
}
