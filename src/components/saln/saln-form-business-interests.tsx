/**
 * SALN Form Section — Business Interests and Financial Connections
 *
 * CSC Form CS-SALN-1 Part III-B: Interests in any business enterprise or financial
 * institution.
 * Fields: entity name, business address, nature, date acquired.
 */

"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { PlusIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FileSalnInput } from "@/lib/validations/saln";

export function SalnFormBusinessInterests() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FileSalnInput>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "businessInterests",
  });

  function addItem() {
    append({
      entityName: "",
      businessAddress: "",
      nature: "",
      dateAcquired: "",
    });
  }

  const fieldErrors = errors.businessInterests;

  return (
    <section aria-labelledby="business-interests-heading">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3
            id="business-interests-heading"
            className="text-base font-semibold text-pcso-navy"
          >
            E. Business Interests and Financial Connections
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ownership, directorship, or membership in any business enterprise or
            financial institution.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Add Business Interest
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No business interests declared.
        </p>
      )}

      <div className="space-y-4">
        {fields.map((field, index) => {
          const itemErrors = Array.isArray(fieldErrors)
            ? fieldErrors[index]
            : undefined;

          return (
            <div
              key={field.id}
              className="rounded-md border border-border bg-card p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  Interest {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  aria-label={`Remove business interest ${index + 1}`}
                  className="text-destructive hover:text-destructive"
                >
                  <TrashIcon className="h-4 w-4" aria-hidden />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Entity Name */}
                <div>
                  <Label htmlFor={`businessInterests.${index}.entityName`}>
                    Name of Entity / Business
                  </Label>
                  <Input
                    id={`businessInterests.${index}.entityName`}
                    {...register(`businessInterests.${index}.entityName`)}
                    placeholder="e.g. Santos Trading Corp."
                    aria-invalid={!!itemErrors?.entityName}
                  />
                  {itemErrors?.entityName && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.entityName.message ?? "")}
                    </p>
                  )}
                </div>

                {/* Nature */}
                <div>
                  <Label htmlFor={`businessInterests.${index}.nature`}>
                    Nature of Business Interest
                  </Label>
                  <Input
                    id={`businessInterests.${index}.nature`}
                    {...register(`businessInterests.${index}.nature`)}
                    placeholder="e.g. Stockholder, Director, Owner"
                    aria-invalid={!!itemErrors?.nature}
                  />
                  {itemErrors?.nature && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.nature.message ?? "")}
                    </p>
                  )}
                </div>

                {/* Business Address */}
                <div>
                  <Label htmlFor={`businessInterests.${index}.businessAddress`}>
                    Business Address
                  </Label>
                  <Input
                    id={`businessInterests.${index}.businessAddress`}
                    {...register(`businessInterests.${index}.businessAddress`)}
                    placeholder="e.g. 123 Rizal Ave., Manila"
                    aria-invalid={!!itemErrors?.businessAddress}
                  />
                  {itemErrors?.businessAddress && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.businessAddress.message ?? "")}
                    </p>
                  )}
                </div>

                {/* Date Acquired */}
                <div>
                  <Label htmlFor={`businessInterests.${index}.dateAcquired`}>
                    Date Acquired
                  </Label>
                  <Input
                    id={`businessInterests.${index}.dateAcquired`}
                    type="date"
                    {...register(`businessInterests.${index}.dateAcquired`)}
                    aria-invalid={!!itemErrors?.dateAcquired}
                  />
                  {itemErrors?.dateAcquired && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.dateAcquired.message ?? "")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
