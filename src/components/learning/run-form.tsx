"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createTrainingRunSchema } from "@/lib/validations/learning";
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
import { CostBreakdownCard } from "./cost-breakdown-card";
import {
  createTrainingRun,
  proposeTrainingRun,
} from "@/lib/actions/ldm/scheduling";

type FormValues = z.infer<typeof createTrainingRunSchema>;

/** ISO (UTC) → `datetime-local` display string in the viewer's local zone. */
function isoToLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface RunFormProps {
  programs: Array<{
    id: string;
    code: string;
    title: string;
    durationDays: number | null;
  }>;
  providers: Array<{ id: string; companyName: string }>;
  defaultProgramId?: string;
}

export function RunForm({
  programs,
  providers,
  defaultProgramId,
}: RunFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [proposing, setProposing] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createTrainingRunSchema),
    defaultValues: {
      programId: defaultProgramId ?? "",
      providerId: "",
      scheduledStart: "",
      scheduledEnd: "",
      venue: "",
      facilitatorFees: "0",
      venueCost: "0",
      perParticipantCost: "0",
      plannedHeadcount: 1,
    },
  });

  const watched = watch();

  async function onSubmit(values: FormValues): Promise<void> {
    setServerError(null);
    try {
      const result = await createTrainingRun(values);
      if ("error" in result) {
        setServerError(`FAILED: ${result.error}`);
        return;
      }
      router.push(`/learning/schedule/${result.data.id}?status=created`);
      router.refresh();
    } catch (err) {
      setServerError(
        `FAILED: ${err instanceof Error ? err.message : "Unexpected error."}`,
      );
    }
  }

  // LDM-004 auto-schedule: compute a suggested window/venue/budget from the
  // selected program + cost inputs and prefill the form for review.
  async function onSuggestSchedule(): Promise<void> {
    setServerError(null);
    const program = programs.find((p) => p.id === watched.programId);
    if (!program || !watched.providerId) {
      setServerError(
        "FAILED: Select a program and provider first to suggest a schedule.",
      );
      return;
    }
    setProposing(true);
    try {
      const proposed = await proposeTrainingRun({
        cost: {
          perParticipantCost: Number(watched.perParticipantCost) || 0,
          plannedHeadcount: Number(watched.plannedHeadcount) || 1,
          venueCost: Number(watched.venueCost) || 0,
          facilitatorFees: Number(watched.facilitatorFees) || 0,
        },
        program: {
          id: program.id,
          name: program.title,
          durationDays: program.durationDays ?? 1,
        },
        provider: { id: watched.providerId, availability: { weeklySlots: [] } },
      });
      setValue(
        "scheduledStart",
        new Date(`${proposed.startDate}T09:00:00`).toISOString(),
        { shouldValidate: true },
      );
      setValue(
        "scheduledEnd",
        new Date(`${proposed.endDate}T17:00:00`).toISOString(),
        { shouldValidate: true },
      );
      setValue("venue", proposed.venue, { shouldValidate: true });
    } catch (err) {
      setServerError(
        `FAILED: ${err instanceof Error ? err.message : "Could not suggest a schedule."}`,
      );
    } finally {
      setProposing(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-6 lg:grid-cols-3"
    >
      <div className="space-y-5 lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Program</Label>
            <Select
              value={watched.programId}
              onValueChange={(v) =>
                setValue("programId", v, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} — {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.programId && (
              <p className="mt-1 text-xs text-destructive">
                {errors.programId.message}
              </p>
            )}
          </div>
          <div>
            <Label>Provider</Label>
            <Select
              value={watched.providerId}
              onValueChange={(v) =>
                setValue("providerId", v, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.providerId && (
              <p className="mt-1 text-xs text-destructive">
                {errors.providerId.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="scheduledStart">Scheduled Start</Label>
            <Input
              id="scheduledStart"
              type="datetime-local"
              value={isoToLocalInput(watched.scheduledStart)}
              onChange={(e) =>
                setValue(
                  "scheduledStart",
                  e.target.value ? new Date(e.target.value).toISOString() : "",
                  { shouldValidate: true },
                )
              }
            />
            {errors.scheduledStart && (
              <p className="mt-1 text-xs text-destructive">
                {errors.scheduledStart.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="scheduledEnd">Scheduled End</Label>
            <Input
              id="scheduledEnd"
              type="datetime-local"
              value={isoToLocalInput(watched.scheduledEnd)}
              onChange={(e) =>
                setValue(
                  "scheduledEnd",
                  e.target.value ? new Date(e.target.value).toISOString() : "",
                  { shouldValidate: true },
                )
              }
            />
            {errors.scheduledEnd && (
              <p className="mt-1 text-xs text-destructive">
                {errors.scheduledEnd.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="venue">Venue</Label>
          <Input id="venue" {...register("venue")} />
          {errors.venue && (
            <p className="mt-1 text-xs text-destructive">
              {errors.venue.message}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <Label htmlFor="plannedHeadcount">Headcount</Label>
            <Input
              id="plannedHeadcount"
              type="number"
              min={1}
              {...register("plannedHeadcount", { valueAsNumber: true })}
            />
            {errors.plannedHeadcount && (
              <p className="mt-1 text-xs text-destructive">
                {errors.plannedHeadcount.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="facilitatorFees">Facilitator Fees</Label>
            <Input
              id="facilitatorFees"
              type="text"
              {...register("facilitatorFees")}
            />
          </div>
          <div>
            <Label htmlFor="venueCost">Venue Cost</Label>
            <Input id="venueCost" type="text" {...register("venueCost")} />
          </div>
          <div>
            <Label htmlFor="perParticipantCost">Per-Participant</Label>
            <Input
              id="perParticipantCost"
              type="text"
              {...register("perParticipantCost")}
            />
          </div>
        </div>

        {serverError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void onSuggestSchedule()}
            disabled={proposing || isSubmitting}
          >
            {proposing ? "Suggesting…" : "Suggest Schedule"}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Propose Run"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </div>

      <aside>
        <CostBreakdownCard
          facilitatorFees={watched.facilitatorFees ?? "0"}
          venueCost={watched.venueCost ?? "0"}
          perParticipantCost={watched.perParticipantCost ?? "0"}
          plannedHeadcount={Number(watched.plannedHeadcount) || 0}
        />
      </aside>
    </form>
  );
}
