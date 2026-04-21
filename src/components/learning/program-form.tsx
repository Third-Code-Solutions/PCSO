"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  createTrainingProgramSchema,
  type CreateTrainingProgramInput,
} from "@/lib/validations/learning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Upstream Agent 08 — may not exist yet. Import is acceptable per swarm gate.
import {
  createTrainingProgram,
  updateTrainingProgram,
} from "@/lib/actions/ldm/catalog";

type FormValues = z.infer<typeof createTrainingProgramSchema>;

interface ProgramFormProps {
  initial?: Partial<CreateTrainingProgramInput> & { id?: string };
  mode: "create" | "edit";
}

const LND_TYPES: Array<FormValues["lndType"]> = [
  "technical",
  "managerial",
  "supervisory",
  "foundational",
  "scholarship",
];

const AUDIENCES: Array<FormValues["targetAudience"][number]> = [
  "all",
  "supervisors",
  "managers",
  "rank_and_file",
  "specialists",
];

export function ProgramForm({ initial, mode }: ProgramFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(createTrainingProgramSchema),
    defaultValues: {
      code: initial?.code ?? "",
      title: initial?.title ?? "",
      lndType: initial?.lndType ?? "technical",
      objectives: initial?.objectives ?? "",
      targetAudience: initial?.targetAudience ?? ["all"],
      mandatoryFlag: initial?.mandatoryFlag ?? false,
      budgetPhp: initial?.budgetPhp ?? null,
      participantCount: initial?.participantCount ?? null,
      durationDays: initial?.durationDays ?? null,
      requirementsChecklist: initial?.requirementsChecklist ?? [],
      learningObjectives: initial?.learningObjectives ?? [],
    },
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: FormValues): Promise<void> {
    setServerError(null);
    try {
      const result =
        mode === "create"
          ? await createTrainingProgram(values)
          : await updateTrainingProgram({ ...values, id: initial?.id ?? "" });
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      router.push("/learning/catalog");
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Unexpected error.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="code">Program Code</Label>
          <Input id="code" {...register("code")} placeholder="TR-0001" />
          {errors.code && (
            <p className="mt-1 text-xs text-destructive">
              {errors.code.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" {...register("title")} />
          {errors.title && (
            <p className="mt-1 text-xs text-destructive">
              {errors.title.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>L&amp;D Type</Label>
          <Controller
            control={control}
            name="lndType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {LND_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div>
          <Label htmlFor="durationDays">Duration (days)</Label>
          <Input
            id="durationDays"
            type="number"
            min={0}
            {...register("durationDays", {
              setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
            })}
          />
        </div>
        <div>
          <Label htmlFor="participantCount">Capacity</Label>
          <Input
            id="participantCount"
            type="number"
            min={0}
            {...register("participantCount", {
              setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
            })}
          />
        </div>
      </div>

      <div>
        <Label>Target Audience</Label>
        <Controller
          control={control}
          name="targetAudience"
          render={({ field }) => (
            <div className="mt-2 flex flex-wrap gap-3">
              {AUDIENCES.map((a) => {
                const checked = field.value?.includes(a) ?? false;
                return (
                  <label
                    key={a}
                    className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        const set = new Set(field.value ?? []);
                        if (c === true) set.add(a);
                        else set.delete(a);
                        const arr = Array.from(
                          set,
                        ) as FormValues["targetAudience"];
                        field.onChange(arr);
                      }}
                    />
                    <span className="capitalize">{a.replace(/_/g, " ")}</span>
                  </label>
                );
              })}
            </div>
          )}
        />
        {errors.targetAudience && (
          <p className="mt-1 text-xs text-destructive">
            {errors.targetAudience.message as string}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="objectives">Objectives</Label>
        <Textarea id="objectives" rows={4} {...register("objectives")} />
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="mandatoryFlag"
          render={({ field }) => (
            <Checkbox
              id="mandatoryFlag"
              checked={field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
            />
          )}
        />
        <Label htmlFor="mandatoryFlag" className="cursor-pointer">
          Mandatory for target audience
        </Label>
      </div>

      <div>
        <Label htmlFor="budgetPhp">Budget (PHP)</Label>
        <Input
          id="budgetPhp"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          {...register("budgetPhp", {
            setValueAs: (v) => (v === "" || v == null ? null : String(v)),
          })}
        />
      </div>

      {serverError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving…"
            : mode === "create"
              ? "Create Program"
              : "Save Changes"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
