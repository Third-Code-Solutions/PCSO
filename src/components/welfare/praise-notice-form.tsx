"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  praiseNoticeFormSchema,
  type PraiseNoticeFormInput,
} from "@/lib/validations/welfare";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SendResult = { data: { id: string } } | { error: string };

type SendAction = (
  input: PraiseNoticeFormInput & { eligibleEmployeeIds: string[] },
) => Promise<SendResult>;

interface PraiseNoticeFormProps {
  onSend: SendAction;
  eligibleEmployeeIds: ReadonlyArray<string>;
}

export function PraiseNoticeForm({
  onSend,
  eligibleEmployeeIds,
}: PraiseNoticeFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PraiseNoticeFormInput>({
    resolver: zodResolver(praiseNoticeFormSchema),
    defaultValues: {
      payrollPeriodStart: "",
      payrollPeriodEnd: "",
      notes: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSubmitting(true);
    try {
      const result = await onSend({
        ...values,
        eligibleEmployeeIds: [...eligibleEmployeeIds],
      });
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      router.refresh();
      router.push("/welfare/praise");
    } catch (error: unknown) {
      setServerError(
        error instanceof Error ? error.message : "Failed to send notice",
      );
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="payrollPeriodStart">Period start</Label>
          <Input
            id="payrollPeriodStart"
            type="date"
            {...register("payrollPeriodStart")}
            aria-invalid={errors.payrollPeriodStart ? "true" : "false"}
          />
          {errors.payrollPeriodStart && (
            <p className="text-xs text-destructive">
              {errors.payrollPeriodStart.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payrollPeriodEnd">Period end</Label>
          <Input
            id="payrollPeriodEnd"
            type="date"
            {...register("payrollPeriodEnd")}
            aria-invalid={errors.payrollPeriodEnd ? "true" : "false"}
          />
          {errors.payrollPeriodEnd && (
            <p className="text-xs text-destructive">
              {errors.payrollPeriodEnd.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>

      <p className="text-xs text-muted-foreground">
        {eligibleEmployeeIds.length} eligible employee
        {eligibleEmployeeIds.length === 1 ? "" : "s"} will be attached to this
        notice.
      </p>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Send advance notice"}
      </Button>
    </form>
  );
}
