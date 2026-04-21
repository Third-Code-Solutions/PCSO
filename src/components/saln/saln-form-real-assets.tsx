/**
 * SALN Form Section — Real Properties
 *
 * CSC Form CS-SALN-1 Schedule A: Land, House & Lot, Condominium, etc.
 * Fields: description, kind, location, year acquired, mode of acquisition,
 *         acquisition cost, assessed value, current fair market value.
 */

"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { PlusIcon, TrashIcon } from "lucide-react";
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
import type { FileSalnInput } from "@/lib/validations/saln";

const ACQUISITION_MODES = [
  { value: "purchase", label: "Purchase" },
  { value: "inheritance", label: "Inheritance" },
  { value: "donation", label: "Donation" },
  { value: "construction", label: "Construction" },
  { value: "other", label: "Other" },
] as const;

const PROPERTY_KINDS = [
  "Land",
  "House & Lot",
  "Condominium",
  "Commercial Building",
  "Agricultural Land",
  "Other",
];

const currentYear = new Date().getFullYear();

export function SalnFormRealAssets() {
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<FileSalnInput>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "realAssets",
  });

  function addItem() {
    append({
      description: "",
      kind: "",
      location: "",
      yearAcquired: currentYear,
      mode: "purchase",
      cost: "0.00",
      assessedValue: "0.00",
      marketValue: "0.00",
    });
  }

  const realAssetsErrors = errors.realAssets;

  return (
    <section aria-labelledby="real-assets-heading">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3
            id="real-assets-heading"
            className="text-base font-semibold text-pcso-navy"
          >
            A. Real Properties
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Land, house & lot, condominium, and other immovable properties.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Add Property
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No real properties declared. Click &ldquo;Add Property&rdquo; to add
          one.
        </p>
      )}

      <div className="space-y-6">
        {fields.map((field, index) => {
          const fieldErrors = Array.isArray(realAssetsErrors)
            ? realAssetsErrors[index]
            : undefined;

          return (
            <div
              key={field.id}
              className="rounded-md border border-border bg-card p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  Property {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  aria-label={`Remove property ${index + 1}`}
                  className="text-destructive hover:text-destructive"
                >
                  <TrashIcon className="h-4 w-4" aria-hidden />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Description */}
                <div className="sm:col-span-2">
                  <Label htmlFor={`realAssets.${index}.description`}>
                    Description
                  </Label>
                  <Input
                    id={`realAssets.${index}.description`}
                    {...register(`realAssets.${index}.description`)}
                    placeholder="e.g. Residential lot with improvements"
                    aria-invalid={!!fieldErrors?.description}
                  />
                  {fieldErrors?.description && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(fieldErrors.description.message ?? "")}
                    </p>
                  )}
                </div>

                {/* Kind */}
                <div>
                  <Label htmlFor={`realAssets.${index}.kind`}>
                    Kind / Type
                  </Label>
                  <Select
                    onValueChange={(v) =>
                      setValue(`realAssets.${index}.kind`, v)
                    }
                    defaultValue={field.kind}
                  >
                    <SelectTrigger id={`realAssets.${index}.kind`}>
                      <SelectValue placeholder="Select kind" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {k}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors?.kind && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(fieldErrors.kind.message ?? "")}
                    </p>
                  )}
                </div>

                {/* Year Acquired */}
                <div>
                  <Label htmlFor={`realAssets.${index}.yearAcquired`}>
                    Year Acquired
                  </Label>
                  <Input
                    id={`realAssets.${index}.yearAcquired`}
                    type="number"
                    min={1900}
                    max={currentYear}
                    {...register(`realAssets.${index}.yearAcquired`, {
                      valueAsNumber: true,
                    })}
                    aria-invalid={!!fieldErrors?.yearAcquired}
                  />
                  {fieldErrors?.yearAcquired && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(fieldErrors.yearAcquired.message ?? "")}
                    </p>
                  )}
                </div>

                {/* Location */}
                <div className="sm:col-span-2">
                  <Label htmlFor={`realAssets.${index}.location`}>
                    Location
                  </Label>
                  <Input
                    id={`realAssets.${index}.location`}
                    {...register(`realAssets.${index}.location`)}
                    placeholder="e.g. Brgy. San Antonio, Quezon City"
                    aria-invalid={!!fieldErrors?.location}
                  />
                  {fieldErrors?.location && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(fieldErrors.location.message ?? "")}
                    </p>
                  )}
                </div>

                {/* Mode of Acquisition */}
                <div>
                  <Label htmlFor={`realAssets.${index}.mode`}>
                    Mode of Acquisition
                  </Label>
                  <Select
                    onValueChange={(v) =>
                      setValue(
                        `realAssets.${index}.mode`,
                        v as FileSalnInput["realAssets"][number]["mode"],
                      )
                    }
                    defaultValue={field.mode}
                  >
                    <SelectTrigger id={`realAssets.${index}.mode`}>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACQUISITION_MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Acquisition Cost */}
                <div>
                  <Label htmlFor={`realAssets.${index}.cost`}>
                    Acquisition Cost (PHP)
                  </Label>
                  <Input
                    id={`realAssets.${index}.cost`}
                    {...register(`realAssets.${index}.cost`)}
                    placeholder="0.00"
                    aria-invalid={!!fieldErrors?.cost}
                  />
                  {fieldErrors?.cost && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(fieldErrors.cost.message ?? "")}
                    </p>
                  )}
                </div>

                {/* Assessed Value */}
                <div>
                  <Label htmlFor={`realAssets.${index}.assessedValue`}>
                    Assessed Value (PHP)
                  </Label>
                  <Input
                    id={`realAssets.${index}.assessedValue`}
                    {...register(`realAssets.${index}.assessedValue`)}
                    placeholder="0.00"
                    aria-invalid={!!fieldErrors?.assessedValue}
                  />
                  {fieldErrors?.assessedValue && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(fieldErrors.assessedValue.message ?? "")}
                    </p>
                  )}
                </div>

                {/* Current Fair Market Value */}
                <div>
                  <Label htmlFor={`realAssets.${index}.marketValue`}>
                    Current Fair Market Value (PHP)
                  </Label>
                  <Input
                    id={`realAssets.${index}.marketValue`}
                    {...register(`realAssets.${index}.marketValue`)}
                    placeholder="0.00"
                    aria-invalid={!!fieldErrors?.marketValue}
                  />
                  {fieldErrors?.marketValue && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(fieldErrors.marketValue.message ?? "")}
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
