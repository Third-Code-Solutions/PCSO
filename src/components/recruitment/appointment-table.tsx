"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Clock, FileText } from "lucide-react";

interface AppointmentRow {
  id: string;
  appointmentNumber: string | null;
  appointmentDate: Date | null;
  effectiveDate: Date | null;
  status: string | null;
  provisioned: boolean | null;
  applicantFirstName: string | null;
  applicantLastName: string | null;
  positionTitle: string | null;
  officeName: string | null;
}

interface AppointmentsTableProps {
  rows: AppointmentRow[];
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function getStatusBadge(status: string | null, provisioned: boolean | null) {
  if (provisioned) {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Provisioned
      </Badge>
    );
  }

  switch (status) {
    case "draft":
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Draft
        </Badge>
      );
    case "pending_documents":
      return (
        <Badge variant="warning" className="gap-1">
          <FileText className="h-3 w-3" />
          Pending Docs
        </Badge>
      );
    case "ready_for_provisioning":
      return (
        <Badge variant="default" className="gap-1">
          <Clock className="h-3 w-3" />
          Ready
        </Badge>
      );
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge variant="secondary">{status ?? "—"}</Badge>;
  }
}

export function AppointmentsTable({ rows }: AppointmentsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No appointments issued yet. Create an appointment from a qualified
          applicant.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Appointment No.</TableHead>
            <TableHead>Applicant</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Office</TableHead>
            <TableHead>Effective Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium font-mono text-sm">
                {row.appointmentNumber ?? "—"}
              </TableCell>
              <TableCell>
                {row.applicantLastName}, {row.applicantFirstName}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.positionTitle ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.officeName ?? "—"}
              </TableCell>
              <TableCell>{formatDate(row.effectiveDate)}</TableCell>
              <TableCell>
                {getStatusBadge(row.status, row.provisioned)}
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/recruitment/appointments/${row.id}`}
                  className="text-sm font-medium text-pcso-navy hover:underline"
                >
                  View
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
