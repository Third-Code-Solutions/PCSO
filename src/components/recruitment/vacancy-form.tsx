"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  createVacancySchema,
  type CreateVacancyInput,
} from "@/lib/validations/recruitment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

interface VacancyFormProps {
  defaultValues?: Partial<CreateVacancyInput>;
  action: (data: CreateVacancyInput) => Promise<ActionResult<{ id: string }>>;
}

export function VacancyForm({ defaultValues, action }: VacancyFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateVacancyInput>({
    resolver: zodResolver(createVacancySchema),
    defaultValues: {
      mrfId: defaultValues?.mrfId ?? null,
      positionId: defaultValues?.positionId ?? "",
      officeId: defaultValues?.officeId ?? "",
      itemNumber: defaultValues?.itemNumber ?? "",
      cscForm9Number: defaultValues?.cscForm9Number ?? "",
      qualificationStandards: defaultValues?.qualificationStandards ?? {
        education: "",
        eligibility: "",
        experience: 0,
        training: "",
      },
      applicationDeadline:
        defaultValues?.applicationDeadline ?? new Date().toISOString(),
    },
  });

  async function onSubmit(data: CreateVacancyInput) {
    try {
      const result = await action(data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Vacancy saved.");
      router.push(`/recruitment/vacancies/${result.data.id}`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save vacancy",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vacancy Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="itemNumber">
                Item Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="itemNumber"
                className="font-mono"
                {...register("itemNumber")}
              />
              {errors.itemNumber && (
                <p className="text-xs text-destructive">
                  {errors.itemNumber.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cscForm9Number">
                CSC Form 9 Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cscForm9Number"
                className="font-mono"
                placeholder="CSC9-YYYY-NNNNNN"
                {...register("cscForm9Number")}
              />
              {errors.cscForm9Number && (
                <p className="text-xs text-destructive">
                  {errors.cscForm9Number.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="applicationDeadline">
                Application Deadline <span className="text-destructive">*</span>
              </Label>
              <Input
                id="applicationDeadline"
                type="datetime-local"
                {...register("applicationDeadline")}
              />
              {errors.applicationDeadline && (
                <p className="text-xs text-destructive">
                  {errors.applicationDeadline.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Qualification Standards</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="education">Education</Label>
              <Textarea
                id="education"
                rows={2}
                {...register("qualificationStandards.education")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eligibility">Eligibility</Label>
              <Input
                id="eligibility"
                {...register("qualificationStandards.eligibility")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="experience">Experience (years)</Label>
              <Input
                id="experience"
                type="number"
                min={0}
                max={60}
                {...register("qualificationStandards.experience", {
                  valueAsNumber: true,
                })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="training">Training</Label>
              <Textarea
                id="training"
                rows={2}
                {...register("qualificationStandards.training")}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save Vacancy"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export default VacancyForm;
