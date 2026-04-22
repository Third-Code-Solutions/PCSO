"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { provisionEmployee } from "@/lib/actions/recruitment-appointments";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  UserPlus,
  FileText,
  Briefcase,
  CreditCard,
  Calendar,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface AppointmentProvisionWizardProps {
  appointment: {
    id: string;
    appointmentNumber: string | null;
    applicantFirstName: string | null;
    applicantLastName: string | null;
    applicantMiddleName: string | null;
    positionTitle: string | null;
    officeName: string | null;
    salaryGrade: number | null;
    stepIncrement: number | null;
    monthlySalary: string | null;
    appointmentDate: Date | null;
    effectiveDate: Date | null;
    appointmentType: string | null;
  };
}

export function AppointmentProvisionWizard({
  appointment,
}: AppointmentProvisionWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<"preview" | "confirm" | "processing">(
    "preview",
  );

  const fullName = [
    appointment.applicantFirstName,
    appointment.applicantMiddleName,
    appointment.applicantLastName,
  ]
    .filter(Boolean)
    .join(" ");

  const handleProvision = () => {
    setStep("confirm");
  };

  const handleConfirm = () => {
    setStep("processing");
    startTransition(async () => {
      const result = await provisionEmployee({ appointmentId: appointment.id });
      if (result.success && result.employeeId) {
        toast.success("Employee provisioned successfully");
        router.push(`/employees/${result.employeeId}`);
      } else {
        toast.error(result.error ?? "Provisioning failed");
        setStep("preview");
      }
    });
  };

  const handleCancel = () => {
    router.push(`/recruitment/appointments/${appointment.id}`);
  };

  const formatCurrency = (amount: string | null): string => {
    if (!amount) return "—";
    const num = parseFloat(amount);
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(num);
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <Card>
        <CardHeader>
          <CardTitle>Provisioning Steps</CardTitle>
          <CardDescription>
            Review appointment details before creating employee record
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  step === "preview"
                    ? "bg-pcso-navy text-pcso-cream"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {step === "preview" ? (
                  "1"
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">Review Details</p>
                <p className="text-xs text-muted-foreground">
                  Verify appointment information
                </p>
              </div>
            </div>

            <div className="h-px flex-1 bg-border mx-4" />

            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  step === "confirm"
                    ? "bg-pcso-navy text-pcso-cream"
                    : step === "processing"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step === "processing" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  "2"
                )}
              </div>
              <div>
                <p className="text-sm font-medium">Confirm Provisioning</p>
                <p className="text-xs text-muted-foreground">
                  Final confirmation required
                </p>
              </div>
            </div>

            <div className="h-px flex-1 bg-border mx-4" />

            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  step === "processing"
                    ? "bg-pcso-navy text-pcso-cream"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step === "processing" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "3"
                )}
              </div>
              <div>
                <p className="text-sm font-medium">Processing</p>
                <p className="text-xs text-muted-foreground">
                  Creating employee record
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appointment Details */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Appointment Details</CardTitle>
              <CardDescription>
                Information to be used for employee provisioning
              </CardDescription>
            </div>
            <Badge variant="success" className="gap-1">
              <FileText className="h-3 w-3" />
              Documents Generated
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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

          <div className="border-t pt-4">
            <div className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Appointee Name
                </dt>
                <dd className="mt-1 text-sm font-medium">{fullName}</dd>
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
                <dd className="mt-1 text-sm">
                  {appointment.officeName ?? "—"}
                </dd>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 grid grid-cols-2 gap-4">
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

          <div className="border-t pt-4 grid grid-cols-3 gap-4">
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
        </CardContent>
      </Card>

      {/* Provisioning Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Provisioning Actions</CardTitle>
          <CardDescription>
            The following records will be created atomically (RPM-023)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <FileText className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Employee 201 File Record</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Personal information, employment details, government IDs
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <Briefcase className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Plantilla Entry Assignment
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Position assignment and item number linkage
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <CreditCard className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Payroll Profile Initialization
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Salary grade, step increment, bank details
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <Calendar className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Leave Ledger Creation</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Vacation, Sick, and Forced Leave credits initialized
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <Clock className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Attendance Schedule Assignment
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Default work schedule from office configuration
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning Alert */}
      {step === "confirm" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-1">
              This action is atomic and cannot be undone.
            </p>
            <p className="text-sm">
              If any part of the provisioning fails, the entire transaction will
              be rolled back. No partial records will be created.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={isPending || step === "processing"}
        >
          Cancel
        </Button>

        {step === "preview" && (
          <Button
            onClick={handleProvision}
            className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            Proceed to Provisioning
          </Button>
        )}

        {step === "confirm" && (
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Provisioning...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Confirm Provisioning
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
