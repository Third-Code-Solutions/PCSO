"use client";

import * as React from "react";
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

type GenerateResult =
  | { data: { runId: string; totalEligible: number } }
  | { error: string };

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
    setSubmitting(true);
    try {
      const result = await onGenerate(values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      router.refresh();
      router.push(`/welfare/loyalty/${result.data.runId}`);
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

      <Button type="submit" disabled={submitting || disabled}>
        {submitting ? "Generating…" : "Generate loyalty run"}
      </Button>
    </form>
  );
}
