/**
 * SalnForm — multi-section SALN filing form
 *
 * Wraps all SALN sections in a single react-hook-form context.
 * Sections: personal info (read-only from employee), real assets,
 * personal properties, investments, liabilities, business interests, relatives.
 * Net worth is computed live in the sidebar.
 *
 * Supports both "save as draft" and "submit" workflows.
 */

"use client";

import { useTransition } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  FileSalnSchema,
  type FileSalnInput,
  type FilingType,
} from "@/lib/validations/saln";
import { SalnFormRealAssets } from "@/components/saln/saln-form-real-assets";
import { SalnFormPersonalProperties } from "@/components/saln/saln-form-personal-properties";
import { SalnFormInvestments } from "@/components/saln/saln-form-investments";
import { SalnFormLiabilities } from "@/components/saln/saln-form-liabilities";
import { SalnFormBusinessInterests } from "@/components/saln/saln-form-business-interests";
import { SalnFormRelatives } from "@/components/saln/saln-form-relatives";
import { NetWorthSummary } from "@/components/saln/net-worth-summary";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertCircleIcon, SaveIcon, SendIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmployeeInfo {
  id: string;
  employeeNo: string;
  fullName: string;
  positionTitle: string;
  officeName: string | null;
  email: string | null;
  dateHired: string;
}

interface SalnFormProps {
  employee: EmployeeInfo;
  year: number;
  filingType: FilingType;
  /** Pre-populated values for edit mode. */
  defaultValues?: Partial<FileSalnInput>;
  onSaveDraft: (data: FileSalnInput) => Promise<{ id: string }>;
  onSubmit: (data: FileSalnInput) => Promise<{ id: string }>;
}

const FILING_TYPE_LABELS: Record<FilingType, string> = {
  annual: "Annual (Calendar Year)",
  initial: "Initial (Upon Entry to Service)",
  upon_assumption: "Upon Assumption of Office",
  upon_separation: "Upon Separation from Service",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SalnForm({
  employee,
  year,
  filingType,
  defaultValues,
  onSaveDraft,
  onSubmit,
}: SalnFormProps) {
  const [isPending, startTransition] = useTransition();

  const methods = useForm<FileSalnInput>({
    resolver: zodResolver(FileSalnSchema),
    defaultValues: {
      employeeId: employee.id,
      year,
      filingType,
      realAssets: [],
      personalProperties: [],
      investments: [],
      liabilities: [],
      businessInterests: [],
      relatives: [],
      submit: false,
      ...defaultValues,
    },
  });

  const {
    handleSubmit,
    setValue,
    formState: { errors },
  } = methods;

  function handleSaveDraft(data: FileSalnInput) {
    startTransition(async () => {
      try {
        const result = await onSaveDraft({ ...data, submit: false });
        toast.success("Draft saved", {
          description: `SALN draft saved. Reference ID: ${result.id.slice(0, 8)}`,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to save draft.";
        toast.error("Save failed", { description: message });
      }
    });
  }

  function handleSubmitFinal(data: FileSalnInput) {
    startTransition(async () => {
      try {
        const result = await onSubmit({ ...data, submit: true });
        toast.success("SALN submitted", {
          description: `Your SALN for ${year} has been submitted to HR. Reference ID: ${result.id.slice(0, 8)}`,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to submit SALN.";
        toast.error("Submission failed", { description: message });
      }
    });
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(handleSubmitFinal)}
        noValidate
        aria-label="SALN Filing Form"
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          {/* Main form column */}
          <div className="space-y-10">
            {/* Personal Info (read-only) */}
            <section aria-labelledby="personal-info-heading">
              <h3
                id="personal-info-heading"
                className="mb-4 text-base font-semibold text-pcso-navy"
              >
                Personal Information
              </h3>
              <div className="rounded-md border border-border bg-muted/30 p-4">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Employee No.
                    </dt>
                    <dd className="text-sm font-medium">
                      {employee.employeeNo}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Full Name</dt>
                    <dd className="text-sm font-medium">{employee.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Position</dt>
                    <dd className="text-sm font-medium">
                      {employee.positionTitle}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Office / Department
                    </dt>
                    <dd className="text-sm font-medium">
                      {employee.officeName ?? "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Coverage Year
                    </dt>
                    <dd className="text-sm font-medium">{year}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Filing Type
                    </dt>
                    <dd className="text-sm font-medium">
                      {FILING_TYPE_LABELS[filingType]}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            <Separator />

            {/* I. Assets */}
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-pcso-navy">I. Assets</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Declare all assets as of December 31, {year}.
                </p>
              </div>

              <SalnFormRealAssets />
              <Separator />
              <SalnFormPersonalProperties />
              <Separator />
              <SalnFormInvestments />
            </div>

            <Separator />

            {/* II. Liabilities */}
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-pcso-navy">
                  II. Liabilities
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Declare all outstanding obligations as of December 31, {year}.
                </p>
              </div>
              <SalnFormLiabilities />
            </div>

            <Separator />

            {/* III. Business Interests */}
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-pcso-navy">
                  III. Business Interests and Financial Connections
                </h2>
              </div>
              <SalnFormBusinessInterests />
            </div>

            <Separator />

            {/* IV. Relatives in Government */}
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-pcso-navy">
                  IV. Relatives in Government Service
                </h2>
              </div>
              <SalnFormRelatives />
            </div>

            {/* Validation errors summary */}
            {hasErrors && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4"
              >
                <AlertCircleIcon
                  className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                  aria-hidden
                />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Please correct the errors above before submitting.
                  </p>
                  <p className="mt-0.5 text-xs text-destructive/80">
                    All required fields must be filled in with valid values.
                  </p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 border-t border-border pt-6">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={handleSubmit(handleSaveDraft)}
              >
                <SaveIcon className="mr-2 h-4 w-4" aria-hidden />
                Save as Draft
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-pcso-navy text-white hover:bg-pcso-navy-light"
              >
                <SendIcon className="mr-2 h-4 w-4" aria-hidden />
                {isPending ? "Submitting..." : "Submit SALN"}
              </Button>

              <p className="ml-auto text-xs text-muted-foreground">
                By submitting, you certify that all information is true and
                correct under penalty of law (RA 6713).
              </p>
            </div>
          </div>

          {/* Sidebar — live net worth */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <NetWorthSummary />
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
