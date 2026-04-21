"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  GsisRegistrationSchema,
  type GsisRegistrationInput,
} from "@/lib/validations/gsis";
import {
  createGsisRegistration,
  updateGsisRegistration,
} from "@/app/(dashboard)/remittances/gsis/actions";
import { Button } from "@/components/ui/button";
import type { GsisRegistration } from "@/lib/db/schema/gsis";

// ─── Field components ─────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}

function Field({ label, error, children, required }: FieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-zinc-700">
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 focus:border-pcso-navy focus:outline-none focus:ring-2 " +
  "focus:ring-pcso-navy/20 disabled:cursor-not-allowed disabled:bg-zinc-50";

// ─── Component ────────────────────────────────────────────────────────────────

interface GsisRegistrationFormProps {
  employeeId: string;
  /** Provide an existing registration to show the form in edit mode */
  existing?: GsisRegistration | null;
  onSuccess?: () => void;
}

export function GsisRegistrationForm({
  employeeId,
  existing,
  onSuccess,
}: GsisRegistrationFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = existing != null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GsisRegistrationInput>({
    resolver: zodResolver(GsisRegistrationSchema),
    defaultValues: {
      employeeId,
      gsisNo: existing?.gsisNo ?? "",
      status: existing?.status ?? "pending",
      registeredDate: existing?.registeredDate ?? "",
      governmentServiceStartDate: existing?.governmentServiceStartDate ?? "",
      isCompulsory: existing?.isCompulsory ?? true,
      enrolledInRetirementFund: existing?.enrolledInRetirementFund ?? false,
      notes: existing?.notes ?? "",
    },
  });

  function onSubmit(data: GsisRegistrationInput) {
    startTransition(async () => {
      try {
        if (isEdit && existing) {
          await updateGsisRegistration({ ...data, id: existing.id });
          toast.success("GSIS registration updated.");
        } else {
          await createGsisRegistration(data);
          toast.success("GSIS registration created.");
        }
        onSuccess?.();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An error occurred.";
        toast.error(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Hidden employee ID */}
      <input type="hidden" {...register("employeeId")} />

      {/* GSIS Number */}
      <Field label="GSIS Number" error={errors.gsisNo?.message} required>
        <input
          {...register("gsisNo")}
          type="text"
          className={inputClass}
          placeholder="11-digit GSIS membership number"
          maxLength={11}
        />
      </Field>

      {/* Status */}
      <Field label="Membership Status" error={errors.status?.message} required>
        <select {...register("status")} className={inputClass}>
          <option value="pending">Pending</option>
          <option value="registered">Registered</option>
          <option value="inactive">Inactive</option>
        </select>
      </Field>

      {/* Government Service Start Date */}
      <Field
        label="Government Service Start Date"
        error={errors.governmentServiceStartDate?.message}
        required
      >
        <input
          {...register("governmentServiceStartDate")}
          type="date"
          className={inputClass}
        />
      </Field>

      {/* Registered Date */}
      <Field
        label="GSIS Registration Date"
        error={errors.registeredDate?.message}
      >
        <input
          {...register("registeredDate")}
          type="date"
          className={inputClass}
        />
        <p className="mt-0.5 text-xs text-zinc-400">
          Date GSIS confirmed the membership (leave blank if pending).
        </p>
      </Field>

      {/* Checkboxes */}
      <fieldset className="space-y-3 rounded-lg border border-zinc-100 p-4">
        <legend className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Membership Options
        </legend>

        <label className="flex items-start gap-3">
          <input
            {...register("isCompulsory")}
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-pcso-navy focus:ring-pcso-navy/20"
          />
          <span className="text-sm text-zinc-700">
            Compulsory member
            <span className="block text-xs text-zinc-400">
              All regular government employees are compulsory members (RA 8291).
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3">
          <input
            {...register("enrolledInRetirementFund")}
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-pcso-navy focus:ring-pcso-navy/20"
          />
          <span className="text-sm text-zinc-700">
            Enrolled in GSIS Retirement Fund
            <span className="block text-xs text-zinc-400">
              Voluntary enrollment in GSIS-RF under RA 8291.
            </span>
          </span>
        </label>
      </fieldset>

      {/* Notes */}
      <Field label="Notes" error={errors.notes?.message}>
        <textarea
          {...register("notes")}
          rows={3}
          className={inputClass}
          placeholder="Optional remarks..."
        />
      </Field>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save Changes" : "Register"}
        </Button>
      </div>
    </form>
  );
}
