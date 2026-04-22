"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, FileText } from "lucide-react";

interface AppointmentDetailsCardProps {
  appointment: {
    id: string;
    appointmentNumber: string | null;
    appointmentDate: Date | null;
    effectiveDate: Date | null;
    salaryGrade: number | null;
    stepIncrement: number | null;
    monthlySalary: string | null;
    appointmentType: string | null;
    status: string | null;
    provisioned: boolean | null;
    applicantFirstName: string | null;
    applicantLastName: string | null;
    applicantMiddleName: string | null;
    applicantEmail: string | null;
    positionTitle: string | null;
    officeName: string | null;
    itemNumber: string | null;
    notes: string | null;
  };
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

function formatCurrency(amount: string | null): string {
  if (!amount) return "—";
  const num = parseFloat(amount);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(num);
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
          Pending Documents
        </Badge>
      );
    case "ready_for_provisioning":
      return (
        <Badge variant="default" className="gap-1">
          <Clock className="h-3 w-3" />
          Ready for Provisioning
        </Badge>
      );
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge variant="secondary">{status ?? "—"}</Badge>;
  }
}

export function AppointmentDetailsCard({
  appointment,
}: AppointmentDetailsCardProps) {
  const fullName = [
    appointment.applicantFirstName,
    appointment.applicantMiddleName,
    appointment.applicantLastName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Appointment Details</CardTitle>
            <CardDescription>CSC appointment information</CardDescription>
          </div>
          {getStatusBadge(appointment.status, appointment.provisioned)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Appointment No.
            </dt>
            <dd className="mt-1 text-sm font-mono">
              {appointment.appointmentNumber ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Appointment Type
            </dt>
            <dd className="mt-1 text-sm capitalize">
              {appointment.appointmentType?.replace(/_/g, " ") ?? "—"}
            </dd>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Appointment Date
            </dt>
            <dd className="mt-1 text-sm">
              {formatDate(appointment.appointmentDate)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Effective Date
            </dt>
            <dd className="mt-1 text-sm">
              {formatDate(appointment.effectiveDate)}
            </dd>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Appointee
              </dt>
              <dd className="mt-1 text-sm font-medium">{fullName}</dd>
              <dd className="text-xs text-muted-foreground">
                {appointment.applicantEmail}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Position
              </dt>
              <dd className="mt-1 text-sm">
                {appointment.positionTitle ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Office
              </dt>
              <dd className="mt-1 text-sm">{appointment.officeName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Item Number
              </dt>
              <dd className="mt-1 text-sm font-mono">
                {appointment.itemNumber ?? "—"}
              </dd>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Salary Grade
              </dt>
              <dd className="mt-1 text-sm">{appointment.salaryGrade ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Step
              </dt>
              <dd className="mt-1 text-sm">
                {appointment.stepIncrement ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Monthly Salary
              </dt>
              <dd className="mt-1 text-sm font-medium">
                {formatCurrency(appointment.monthlySalary)}
              </dd>
            </div>
          </div>
        </div>

        {appointment.notes && (
          <div className="border-t pt-4">
            <dt className="text-sm font-medium text-muted-foreground">Notes</dt>
            <dd className="mt-1 text-sm whitespace-pre-wrap">
              {appointment.notes}
            </dd>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
