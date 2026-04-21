"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  createMrfSchema,
  type CreateMrfInput,
} from "@/lib/validations/recruitment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Tolerant result envelope — accepts both `{ ok, data }` and `{ data } | { error }` shapes.
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }
  | { data: T }
  | { error: string };

interface OfficeOption {
  id: string;
  name: string;
  code: string;
}

interface PositionOption {
  id: string;
  itemNumber: string;
  title: string;
}

interface MrfFormProps {
  offices: OfficeOption[];
  positions: PositionOption[];
  requesterEmployeeId: string;
  defaultValues?: Partial<CreateMrfInput>;
  action: (data: CreateMrfInput) => Promise<ActionResult<{ id: string }>>;
}

function extractData<T>(result: ActionResult<T>): T | null {
  if ("error" in result && result.error) return null;
  if ("ok" in result && result.ok === false) return null;
  if ("data" in result) return result.data;
  return null;
}

function extractError(result: ActionResult<unknown>): string | null {
  if ("error" in result && typeof result.error === "string")
    return result.error;
  return null;
}

export function MrfForm({
  offices,
  positions,
  requesterEmployeeId,
  defaultValues,
  action,
}: MrfFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateMrfInput>({
    resolver: zodResolver(createMrfSchema),
    defaultValues: {
      positionId: defaultValues?.positionId ?? "",
      officeId: defaultValues?.officeId ?? "",
      requestedByEmployeeId:
        defaultValues?.requestedByEmployeeId ?? requesterEmployeeId,
      itemNumber: defaultValues?.itemNumber ?? "",
      justification: defaultValues?.justification ?? "",
      numberOfVacancies: defaultValues?.numberOfVacancies ?? 1,
    },
  });

  const selectedPositionId = watch("positionId");
  const selectedOfficeId = watch("officeId");

  async function onSubmit(data: CreateMrfInput) {
    try {
      const result = await action(data);
      const payload = extractData(result);
      if (!payload) {
        toast.error(extractError(result) ?? "Failed to create MRF");
        return;
      }
      toast.success("MRF created.");
      router.push(`/recruitment/mrf/${payload.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create MRF");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manpower Request</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="positionId">
                Plantilla Position <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedPositionId}
                onValueChange={(v) =>
                  setValue("positionId", v, { shouldValidate: true })
                }
              >
                <SelectTrigger id="positionId">
                  <SelectValue placeholder="Select vacant plantilla position" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-mono">{p.itemNumber}</span>
                      <span className="ml-2">{p.title}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.positionId && (
                <p className="text-xs text-destructive">
                  {errors.positionId.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="officeId">
                Requesting Office <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedOfficeId}
                onValueChange={(v) =>
                  setValue("officeId", v, { shouldValidate: true })
                }
              >
                <SelectTrigger id="officeId">
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                      <span className="ml-2 text-muted-foreground text-xs">
                        ({o.code})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.officeId && (
                <p className="text-xs text-destructive">
                  {errors.officeId.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="itemNumber">
                Item Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="itemNumber"
                placeholder="e.g. P-001"
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
              <Label htmlFor="numberOfVacancies">
                Number of Vacancies <span className="text-destructive">*</span>
              </Label>
              <Input
                id="numberOfVacancies"
                type="number"
                min={1}
                max={100}
                {...register("numberOfVacancies", { valueAsNumber: true })}
              />
              {errors.numberOfVacancies && (
                <p className="text-xs text-destructive">
                  {errors.numberOfVacancies.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="justification">
                Justification <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="justification"
                placeholder="Explain why this position must be filled now."
                rows={5}
                {...register("justification")}
              />
              {errors.justification && (
                <p className="text-xs text-destructive">
                  {errors.justification.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Create MRF"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export default MrfForm;
