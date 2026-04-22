"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  createProviderSchema,
  type CreateProviderInput,
} from "@/lib/validations/learning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
// Upstream Agent 08 — may not exist yet.
import { createProvider, updateProvider } from "@/lib/actions/ldm/providers";

type FormValues = z.infer<typeof createProviderSchema>;

interface ProviderFormProps {
  initial?: Partial<CreateProviderInput> & { id?: string };
  mode: "create" | "edit";
}

export function ProviderForm({ initial, mode }: ProviderFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createProviderSchema),
    defaultValues: {
      companyName: initial?.companyName ?? "",
      accreditationNumber: initial?.accreditationNumber ?? null,
      accreditationExpires: initial?.accreditationExpires ?? null,
      contactEmail: initial?.contactEmail ?? "",
      contactNumber: initial?.contactNumber ?? "",
      address: initial?.address ?? null,
      trainers: initial?.trainers ?? [],
      programsOffered: initial?.programsOffered ?? [],
    },
  });

  async function onSubmit(values: FormValues): Promise<void> {
    setServerError(null);
    try {
      const result =
        mode === "create"
          ? await createProvider(values)
          : await updateProvider({ ...values, id: initial?.id ?? "" });
      if ("error" in result) {
        setServerError(`FAILED: ${result.error}`);
        return;
      }
      const status = mode === "create" ? "created" : "updated";
      router.push(`/learning/providers?status=${status}`);
      router.refresh();
    } catch (err) {
      setServerError(
        `FAILED: ${err instanceof Error ? err.message : "Unexpected error."}`,
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <Label htmlFor="companyName">Company Name</Label>
        <Input id="companyName" {...register("companyName")} />
        {errors.companyName && (
          <p className="mt-1 text-xs text-destructive">
            {errors.companyName.message}
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="accreditationNumber">Accreditation Number</Label>
          <Input
            id="accreditationNumber"
            {...register("accreditationNumber", {
              setValueAs: (v) => (v === "" || v == null ? null : String(v)),
            })}
          />
        </div>
        <div>
          <Label htmlFor="accreditationExpires">Accreditation Expires</Label>
          <Input
            id="accreditationExpires"
            type="date"
            {...register("accreditationExpires", {
              setValueAs: (v) => (v === "" || v == null ? null : String(v)),
            })}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contactEmail">Contact Email</Label>
          <Input id="contactEmail" type="email" {...register("contactEmail")} />
          {errors.contactEmail && (
            <p className="mt-1 text-xs text-destructive">
              {errors.contactEmail.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="contactNumber">Contact Number</Label>
          <Input id="contactNumber" {...register("contactNumber")} />
          {errors.contactNumber && (
            <p className="mt-1 text-xs text-destructive">
              {errors.contactNumber.message}
            </p>
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          rows={3}
          {...register("address", {
            setValueAs: (v) => (v === "" || v == null ? null : String(v)),
          })}
        />
      </div>

      <div>
        <Label htmlFor="trainers">Trainers / Resource Persons</Label>
        <Textarea
          id="trainers"
          rows={4}
          placeholder="Enter trainers in format: Name | Qualifications | Expertise1, Expertise2 (one per line)"
          {...register("trainers", {
            setValueAs: (v) => {
              if (typeof v !== "string" || v.trim() === "") return [];
              return v
                .split("\n")
                .filter((line) => line.trim())
                .map((line) => {
                  const parts = line.split("|").map((p) => p.trim());
                  return {
                    name: parts[0] || "",
                    qualifications: parts[1] || "",
                    expertise: parts[2]
                      ? parts[2].split(",").map((e) => e.trim())
                      : [],
                  };
                });
            },
          })}
          defaultValue={
            initial?.trainers
              ? (
                  initial.trainers as Array<{
                    name: string;
                    qualifications?: string;
                    expertise?: string[];
                  }>
                )
                  .map(
                    (t) =>
                      `${t.name} | ${t.qualifications || ""} | ${(t.expertise || []).join(", ")}`,
                  )
                  .join("\n")
              : ""
          }
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Format: Name | Qualifications | Expertise1, Expertise2 (one trainer
          per line)
        </p>
      </div>

      <div>
        <Label htmlFor="programsOffered">Programs Offered (UUIDs)</Label>
        <Textarea
          id="programsOffered"
          rows={3}
          placeholder="Enter program UUIDs, one per line (use catalog page to find IDs)"
          {...register("programsOffered", {
            setValueAs: (v) => {
              if (typeof v !== "string" || v.trim() === "") return [];
              return v
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line);
            },
          })}
          defaultValue={
            initial?.programsOffered
              ? (initial.programsOffered as string[]).join("\n")
              : ""
          }
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Enter training program UUIDs that this provider can deliver. One per
          line.
        </p>
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
              ? "Create Provider"
              : "Save Changes"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
