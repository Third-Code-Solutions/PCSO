"use client";

/**
 * /portal/promotion — client shell (TOR 1.9.13 / EPM-014).
 *
 * Open vacancy cards with qualification standards + one-click apply
 * (pre-filled from the 201 file), plus the employee's application history.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Briefcase, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { applyForPromotion } from "@/lib/actions/portal/promotion";

interface VacancyCard {
  id: string;
  itemNumber: string;
  cscForm9Number: string;
  applicationDeadline: string;
  qualificationStandards: unknown;
  positionTitle: string;
  salaryGrade: number | null;
  officeName: string;
}

interface ApplicationRow {
  id: string;
  applicationNumber: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  positionTitle: string;
  officeName: string;
  itemNumber: string;
}

interface PromotionClientProps {
  vacancies: VacancyCard[];
  myApplications: ApplicationRow[];
  appliedItemNumbers: string[];
  loadError: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  incomplete: "Incomplete",
  submitted: "Submitted",
  under_review: "Under Review",
  qualified: "Qualified",
  not_qualified: "Not Qualified",
  shortlisted: "Shortlisted",
  for_exam: "For Exam",
  for_interview: "For Interview",
  results_released: "Results Released",
  withdrawn: "Withdrawn",
};

const STATUS_VARIANTS: Record<
  string,
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "warning"
  | "info"
  | "muted"
  | "outline"
> = {
  incomplete: "secondary",
  submitted: "warning",
  under_review: "info",
  qualified: "success",
  not_qualified: "destructive",
  shortlisted: "success",
  for_exam: "info",
  for_interview: "info",
  results_released: "default",
  withdrawn: "muted",
};

interface QualificationStandards {
  education?: string;
  eligibility?: string;
  experience?: number;
  training?: string;
}

function parseQs(value: unknown): QualificationStandards {
  if (value && typeof value === "object")
    return value as QualificationStandards;
  return {};
}

export function PromotionClient({
  vacancies,
  myApplications,
  appliedItemNumbers,
  loadError,
}: PromotionClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [applyTarget, setApplyTarget] = useState<VacancyCard | null>(null);

  const appliedSet = new Set(appliedItemNumbers);

  const handleApply = () => {
    if (!applyTarget) return;
    startTransition(async () => {
      const result = await applyForPromotion({ vacancyId: applyTarget.id });
      if ("data" in result) {
        toast.success(
          `Application ${result.data.applicationNumber} submitted — HRD will screen your qualifications`,
        );
        setApplyTarget(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-pcso-navy">
            Promotion Applications
          </h1>
          <p className="text-sm text-muted-foreground">
            Apply to published PCSO vacancies. Your application is pre-filled
            from your 201 file and enters the same CSC-compliant screening
            pipeline as external applicants.
          </p>
        </div>
        <TrendingUp className="h-8 w-8 shrink-0 text-pcso-navy" />
      </div>

      {loadError && (
        <div className="flex gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold text-pcso-navy">
          Open Vacancies ({vacancies.length})
        </h2>
        {vacancies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Briefcase className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-2 font-semibold text-pcso-navy">
                No Open Vacancies
              </h3>
              <p className="text-sm text-muted-foreground">
                There are no published vacancies accepting applications right
                now.
              </p>
            </CardContent>
          </Card>
        ) : (
          vacancies.map((vacancy) => {
            const qs = parseQs(vacancy.qualificationStandards);
            const alreadyApplied = appliedSet.has(vacancy.itemNumber);
            return (
              <Card key={vacancy.id} className="border-pcso-navy/10">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {vacancy.positionTitle}
                        {vacancy.salaryGrade
                          ? ` (SG ${vacancy.salaryGrade})`
                          : ""}
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        {vacancy.officeName} · Item {vacancy.itemNumber} ·{" "}
                        {vacancy.cscForm9Number}
                      </CardDescription>
                    </div>
                    <Badge variant="info">
                      Apply by{" "}
                      {format(
                        new Date(vacancy.applicationDeadline),
                        "MMM d, yyyy",
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    {qs.education && (
                      <p>
                        <span className="font-medium">Education:</span>{" "}
                        {qs.education}
                      </p>
                    )}
                    {qs.eligibility && (
                      <p>
                        <span className="font-medium">Eligibility:</span>{" "}
                        {qs.eligibility}
                      </p>
                    )}
                    {typeof qs.experience === "number" && (
                      <p>
                        <span className="font-medium">Experience:</span>{" "}
                        {qs.experience} year{qs.experience === 1 ? "" : "s"}
                      </p>
                    )}
                    {qs.training && (
                      <p>
                        <span className="font-medium">Training:</span>{" "}
                        {qs.training}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={isPending || alreadyApplied}
                      className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
                      onClick={() => setApplyTarget(vacancy)}
                    >
                      {alreadyApplied
                        ? "Already Applied"
                        : "Apply for Promotion"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-pcso-navy">My Applications</h2>
        {myApplications.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You haven&apos;t applied to any vacancy yet.
          </p>
        ) : (
          myApplications.map((app) => (
            <Card key={app.id} className="border-pcso-navy/10">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {app.positionTitle} · {app.officeName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {app.applicationNumber} · Item {app.itemNumber} · Filed{" "}
                    {format(
                      new Date(app.submittedAt ?? app.createdAt),
                      "MMM d, yyyy",
                    )}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANTS[app.status] ?? "secondary"}>
                  {STATUS_LABELS[app.status] ?? app.status}
                </Badge>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <Dialog
        open={applyTarget !== null}
        onOpenChange={(open) => {
          if (!open) setApplyTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for {applyTarget?.positionTitle}?</DialogTitle>
            <DialogDescription>
              Your application will be pre-filled from your 201 file (education,
              eligibility, work experience, and trainings) and submitted to HRD
              with the internal-applicant tag. Make sure your PDS is up to date
              — you can request updates under Portal → Update PDS.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApplyTarget(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={isPending}
              className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
