"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  loyaltyRunFormSchema,
  type LoyaltyRunFormInput,
} from "@/lib/validations/welfare";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type GenerateSuccess = {
  runId: string;
  totalEligible: number;
  added: number;
  reused: boolean;
};

type GenerateResult = { data: GenerateSuccess } | { error: string };

type GenerateAction = (input: LoyaltyRunFormInput) => Promise<GenerateResult>;

interface LoyaltyRunFormProps {
  /** Server action injected by the parent Server Component. */
  onGenerate: GenerateAction;
  /** Optional preset year (defaults to current year). */
  defaultYear?: number;
  disabled?: boolean;
}

export function LoyaltyRunForm({
  onGenerate,
  defaultYear,
  disabled = false,
}: LoyaltyRunFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [lastRun, setLastRun] = React.useState<GenerateSuccess | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoyaltyRunFormInput>({
    resolver: zodResolver(loyaltyRunFormSchema),
    defaultValues: {
      runYear: defaultYear ?? new Date().getFullYear(),
      filterUnitOfficeId: null,
      notes: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setLastRun(null);
    setSubmitting(true);
    try {
      const result = await onGenerate(values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setLastRun(result.data);
      router.refresh();
    } catch (error: unknown) {
      setServerError(
        error instanceof Error ? error.message : "Failed to generate run",
      );
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="runYear">Run year</Label>
        <Input
          id="runYear"
          type="number"
          min={2000}
          max={2100}
          {...register("runYear", { valueAsNumber: true })}
          aria-invalid={errors.runYear ? "true" : "false"}
        />
        {errors.runYear && (
          <p className="text-xs text-destructive">{errors.runYear.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input id="notes" type="text" {...register("notes")} />
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      {lastRun && (
        <p role="status" className="text-sm text-muted-foreground">
          {lastRun.reused ? "Existing run updated" : "New run created"}:{" "}
          {lastRun.totalEligible} eligible, {lastRun.added} newly added
          {lastRun.reused
            ? `, ${lastRun.totalEligible - lastRun.added} already listed`
            : ""}
          .{" "}
          <Link
            href={`/welfare/loyalty/${lastRun.runId}`}
            className="font-medium text-foreground underline underline-offset-4"
          >
            View run
          </Link>
        </p>
      )}

      <Button type="submit" disabled={submitting || disabled}>
        {submitting ? "Generating…" : "Generate loyalty run"}
      </Button>
    </form>
  );
}
