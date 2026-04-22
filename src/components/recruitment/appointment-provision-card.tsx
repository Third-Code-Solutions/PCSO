"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { provisionEmployee } from "@/lib/actions/recruitment-appointments";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  UserPlus,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface AppointmentProvisionCardProps {
  appointment: {
    id: string;
    status: string | null;
    provisioned: boolean | null;
    provisionedAt: Date | null;
    provisionedEmployeeId: string | null;
    generatedDocuments: unknown;
  };
}

export function AppointmentProvisionCard({
  appointment,
}: AppointmentProvisionCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const canProvision =
    appointment.status === "ready_for_provisioning" && !appointment.provisioned;
  const docs =
    appointment.generatedDocuments &&
    typeof appointment.generatedDocuments === "object";

  const handleProvision = () => {
    if (
      !confirm(
        "This will atomically create the employee record across all modules. Continue?",
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await provisionEmployee({ appointmentId: appointment.id });
      if (result.success && result.employeeId) {
        toast.success("Employee provisioned successfully");
        router.refresh();
      } else {
        toast.error(result.error ?? "Provisioning failed");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Employee Provisioning</CardTitle>
            <CardDescription>
              Auto-provision employee across modules (RPM-023)
            </CardDescription>
          </div>
          {appointment.provisioned && (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Provisioned
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {appointment.provisioned ? (
          <>
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Employee record created successfully on{" "}
                {appointment.provisionedAt
                  ? new Date(appointment.provisionedAt).toLocaleDateString(
                      "en-PH",
                      {
                        year: "numeric",
                        month: "long",
                        day: "2-digit",
                      },
                    )
                  : "—"}
                .
              </AlertDescription>
            </Alert>

            {appointment.provisionedEmployeeId && (
              <div className="flex justify-center pt-2">
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/employees/${appointment.provisionedEmployeeId}`}
                  >
                    <ExternalLink className="mr-1.5 h-4 w-4" />
                    View Employee Record
                  </Link>
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <h4 className="text-sm font-medium">Provisioning will create:</h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                  Employee 201 file record
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                  Plantilla entry assignment
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                  Payroll profile initialization
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                  Leave ledger creation (VL, SL, Forced)
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                  Attendance schedule assignment
                </li>
              </ul>
            </div>

            {!docs && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Documents must be generated before provisioning. Go to
                  Documents tab and click &quot;Generate All&quot;.
                </AlertDescription>
              </Alert>
            )}

            {appointment.status !== "ready_for_provisioning" && docs && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Appointment status must be &quot;ready_for_provisioning&quot;
                  to proceed.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button
                asChild
                disabled={!canProvision}
                className="flex-1 bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
              >
                <Link
                  href={`/recruitment/appointments/${appointment.id}/provision`}
                >
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Provision in Wizard
                </Link>
              </Button>

              <Button
                onClick={handleProvision}
                disabled={!canProvision || isPending}
                variant="outline"
                className="flex-1"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Provisioning...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-1.5 h-4 w-4" />
                    Quick Provision
                  </>
                )}
              </Button>
            </div>

            {!canProvision && !isPending && (
              <p className="text-xs text-center text-muted-foreground">
                {!docs
                  ? "Generate documents first"
                  : appointment.status !== "ready_for_provisioning"
                    ? "Appointment not ready"
                    : "Prerequisites not met"}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
