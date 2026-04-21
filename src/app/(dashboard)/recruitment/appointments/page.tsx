import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAppointments } from "@/lib/actions/rpm/appointment";

export const metadata: Metadata = {
  title: "Appointments",
};

interface AppointmentRow {
  id?: string;
  employeeId: string;
  employeeNo?: string;
  fullName?: string;
  employeeName?: string | null;
  positionTitle: string | null;
  appointmentType: string;
  effectiveDate?: Date | string;
  dateHired?: Date | string;
  issuedAt?: Date | string;
}

function formatDate(value: Date | string | undefined | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function AppointmentsListPage() {
  const result = (await listAppointments(100).catch(() => [])) as unknown;
  const rows: AppointmentRow[] = Array.isArray(result)
    ? (result as AppointmentRow[])
    : ((result as { rows?: AppointmentRow[] } | null)?.rows ?? []);

  return (
    <div>
      <PageHeader
        title="Appointments"
        description="Issued appointments onboarded into the employee roster."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "Appointments" },
        ]}
        actions={
          <Button size="sm" asChild>
            <Link href="/recruitment/appointments/new">
              <Plus className="mr-2 h-4 w-4" />
              Issue Appointment
            </Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No appointments issued yet.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id ?? row.employeeId}>
                  <TableCell className="font-medium">
                    {row.fullName ?? row.employeeName ?? row.employeeNo ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.positionTitle ?? "—"}
                  </TableCell>
                  <TableCell className="capitalize">
                    {String(row.appointmentType ?? "").replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    {formatDate(row.effectiveDate ?? row.dateHired)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.issuedAt ?? row.dateHired)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/employees/${row.employeeId}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Employee
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
