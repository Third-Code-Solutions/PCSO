"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as React from "react";
import {
  appointmentIssueSchema,
  type AppointmentIssueInput,
} from "@/lib/validations/recruitment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ShortlistedApplicantOption {
  applicationId: string;
  vacancyId: string;
  applicantName: string;
  position: string;
}

interface AppointmentIssueResult {
  employeeId: string;
  pdfUrls?: {
    label: string;
    href: string;
  }[];
}

interface AppointmentFormProps {
  shortlisted: ShortlistedApplicantOption[];
  issuerEmployeeId: string;
  issueAction: (
    data: AppointmentIssueInput & {
      openingLeaveBalanceVlDays: number;
      openingLeaveBalanceSlDays: number;
    },
  ) => Promise<ActionResult<AppointmentIssueResult>>;
}

const SALARY_GRADES = Array.from({ length: 33 }, (_, i) => i + 1);
const STEPS = Array.from({ length: 8 }, (_, i) => i + 1);
const TYPES: AppointmentIssueInput["appointmentType"][] = [
  "permanent",
  "temporary",
  "coterminous",
  "casual",
  "job_order",
  "contract_of_service",
];

export function AppointmentForm({
  shortlisted,
  issuerEmployeeId,
  issueAction,
}: AppointmentFormProps) {
  const router = useRouter();
  const [issuedPdfUrls, setIssuedPdfUrls] = React.useState<
    AppointmentIssueResult["pdfUrls"] | null
  >(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<
    AppointmentIssueInput & {
      openingLeaveBalanceVlDays: number;
      openingLeaveBalanceSlDays: number;
    }
  >({
    resolver: zodResolver(
      appointmentIssueSchema.extend({
        openingLeaveBalanceVlDays: appointmentIssueSchema.shape.step,
        openingLeaveBalanceSlDays: appointmentIssueSchema.shape.step,
      } as unknown as Parameters<typeof appointmentIssueSchema.extend>[0]),
    ),
    defaultValues: {
      vacancyId: "",
      applicationId: "",
      appointmentType: "permanent",
      effectiveDate: new Date().toISOString(),
      salaryGrade: 1,
      step: 1,
      issuedByEmployeeId: issuerEmployeeId,
      openingLeaveBalanceVlDays: 0,
      openingLeaveBalanceSlDays: 0,
    },
  });

  const selectedApplicationId = watch("applicationId");
  const selectedType = watch("appointmentType");
  const selectedSg = watch("salaryGrade");
  const selectedStep = watch("step");

  function onPickApplicant(applicationId: string) {
    const match = shortlisted.find((s) => s.applicationId === applicationId);
    setValue("applicationId", applicationId, { shouldValidate: true });
    if (match) setValue("vacancyId", match.vacancyId, { shouldValidate: true });
  }

  async function onSubmit(
    data: AppointmentIssueInput & {
      openingLeaveBalanceVlDays: number;
      openingLeaveBalanceSlDays: number;
    },
  ) {
    try {
      const result = await issueAction(data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Appointment issued.");
      if (result.data.pdfUrls && result.data.pdfUrls.length > 0) {
        setIssuedPdfUrls(result.data.pdfUrls);
      } else {
        router.push(`/employees/${result.data.employeeId}`);
        router.refresh();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to issue appointment",
      );
    }
  }

  if (issuedPdfUrls) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appointment Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Download each generated document below.
          </p>
          <ul className="space-y-2">
            {issuedPdfUrls.map((pdf) => (
              <li key={pdf.href}>
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={pdf.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {pdf.label}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="default"
            onClick={() => router.push("/recruitment/appointments")}
          >
            Back to Appointments
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appointee</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="applicationId">
                Shortlisted Applicant{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedApplicationId}
                onValueChange={onPickApplicant}
              >
                <SelectTrigger id="applicationId">
                  <SelectValue placeholder="Select shortlisted applicant" />
                </SelectTrigger>
                <SelectContent>
                  {shortlisted.map((s) => (
                    <SelectItem key={s.applicationId} value={s.applicationId}>
                      {s.applicantName}
                      <span className="ml-2 text-muted-foreground text-xs">
                        {s.position}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.applicationId && (
                <p className="text-xs text-destructive">
                  {errors.applicationId.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Position & Compensation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="appointmentType">Appointment Type</Label>
              <Select
                value={selectedType}
                onValueChange={(v) =>
                  setValue(
                    "appointmentType",
                    v as AppointmentIssueInput["appointmentType"],
                    {
                      shouldValidate: true,
                    },
                  )
                }
              >
                <SelectTrigger id="appointmentType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="effectiveDate">
                Effective Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="effectiveDate"
                type="datetime-local"
                {...register("effectiveDate")}
              />
              {errors.effectiveDate && (
                <p className="text-xs text-destructive">
                  {errors.effectiveDate.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salaryGrade">Salary Grade</Label>
              <Select
                value={String(selectedSg)}
                onValueChange={(v) =>
                  setValue("salaryGrade", parseInt(v, 10), {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="salaryGrade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALARY_GRADES.map((sg) => (
                    <SelectItem key={sg} value={String(sg)}>
                      SG-{sg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="step">Step</Label>
              <Select
                value={String(selectedStep)}
                onValueChange={(v) =>
                  setValue("step", parseInt(v, 10), { shouldValidate: true })
                }
              >
                <SelectTrigger id="step">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STEPS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      Step {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opening Leave Balances</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="openingLeaveBalanceVlDays">
                Vacation Leave (days)
              </Label>
              <Input
                id="openingLeaveBalanceVlDays"
                type="number"
                min={0}
                step={0.125}
                className="font-mono"
                {...register("openingLeaveBalanceVlDays", {
                  valueAsNumber: true,
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="openingLeaveBalanceSlDays">
                Sick Leave (days)
              </Label>
              <Input
                id="openingLeaveBalanceSlDays"
                type="number"
                min={0}
                step={0.125}
                className="font-mono"
                {...register("openingLeaveBalanceSlDays", {
                  valueAsNumber: true,
                })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Issuing…" : "Issue Appointment"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export default AppointmentForm;
