/**
 * /recruitment/appointments — List all appointments (RPM-022..025).
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import type { Role } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/role-gate";
import { ActionStatusBanner } from "@/components/feedback/action-status-banner";
import { listAppointments } from "@/lib/actions/recruitment-appointments";
import { AppointmentsTable } from "@/components/recruitment/appointment-table";
import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Appointments" };

const ADMIN_ROLES: ReadonlyArray<Role> = ["super_admin", "hr_admin"];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AppointmentsListPage({
  searchParams,
}: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const statusRaw = Array.isArray(params["status"])
    ? params["status"][0]
    : params["status"];

  const rows = await listAppointments();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title="Appointments"
        description="CSC appointments issued from recruitment process. Auto-provision creates employee across all modules."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "Appointments" },
        ]}
        actions={
          <RoleGate role={user.role} roles={ADMIN_ROLES} fallback={null}>
            <Button
              size="sm"
              asChild
              className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
            >
              <Link href="/recruitment/appointments/new">
                <PlusIcon className="mr-1.5 h-4 w-4" />
                New Appointment
              </Link>
            </Button>
          </RoleGate>
        }
      />
      <ActionStatusBanner status={statusRaw} entityLabel="Appointment" />
      <div className="mt-6">
        <AppointmentsTable
          rows={
            rows as unknown as Parameters<typeof AppointmentsTable>[0]["rows"]
          }
        />
      </div>
    </main>
  );
}
