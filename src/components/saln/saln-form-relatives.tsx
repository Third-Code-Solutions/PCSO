/**
 * SALN Form Section — Relatives in Government Service
 *
 * CSC Form CS-SALN-1 Part IV: Relatives within the fourth civil degree of
 * consanguinity or affinity in the government service.
 * Basis: Section 8(A) of Republic Act No. 6713.
 *
 * Fields: name, relationship, position, agency and address.
 */

"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { PlusIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FileSalnInput } from "@/lib/validations/saln";

const RELATIONSHIPS = [
  "Spouse",
  "Child",
  "Parent",
  "Sibling",
  "Grandparent",
  "Grandchild",
  "Uncle / Aunt",
  "Nephew / Niece",
  "First Cousin",
  "Other",
];

export function SalnFormRelatives() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FileSalnInput>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "relatives",
  });

  function addItem() {
    append({
      name: "",
      relationship: "",
      position: "",
      agencyAddress: "",
    });
  }

  const fieldErrors = errors.relatives;

  return (
    <section aria-labelledby="relatives-heading">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3
            id="relatives-heading"
            className="text-base font-semibold text-pcso-navy"
          >
            F. Relatives in Government Service
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Relatives within the fourth civil degree of consanguinity or
            affinity who are in government service (Section 8, RA 6713).
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Add Relative
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No relatives in government service to declare.
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
                  Relative {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  aria-label={`Remove relative ${index + 1}`}
                  className="text-destructive hover:text-destructive"
                >
                  <TrashIcon className="h-4 w-4" aria-hidden />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Name */}
                <div>
                  <Label htmlFor={`relatives.${index}.name`}>Full Name</Label>
                  <Input
                    id={`relatives.${index}.name`}
                    {...register(`relatives.${index}.name`)}
                    placeholder="Last Name, First Name M.I."
                    aria-invalid={!!itemErrors?.name}
                  />
                  {itemErrors?.name && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.name.message ?? "")}
                    </p>
                  )}
                </div>

                {/* Relationship */}
                <div>
                  <Label htmlFor={`relatives.${index}.relationship`}>
                    Relationship
                  </Label>
                  <Input
                    id={`relatives.${index}.relationship`}
                    {...register(`relatives.${index}.relationship`)}
                    placeholder="e.g. Spouse, Child, Sibling"
                    list={`relationship-types-${index}`}
                    aria-invalid={!!itemErrors?.relationship}
                  />
                  <datalist id={`relationship-types-${index}`}>
                    {RELATIONSHIPS.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                  {itemErrors?.relationship && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.relationship.message ?? "")}
                    </p>
                  )}
                </div>

                {/* Position */}
                <div>
                  <Label htmlFor={`relatives.${index}.position`}>
                    Position / Designation
                  </Label>
                  <Input
                    id={`relatives.${index}.position`}
                    {...register(`relatives.${index}.position`)}
                    placeholder="e.g. Clerk III, Revenue Officer"
                    aria-invalid={!!itemErrors?.position}
                  />
                  {itemErrors?.position && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.position.message ?? "")}
                    </p>
                  )}
                </div>

                {/* Agency and Address */}
                <div>
                  <Label htmlFor={`relatives.${index}.agencyAddress`}>
                    Agency and Address
                  </Label>
                  <Input
                    id={`relatives.${index}.agencyAddress`}
                    {...register(`relatives.${index}.agencyAddress`)}
                    placeholder="e.g. BIR, Quezon City"
                    aria-invalid={!!itemErrors?.agencyAddress}
                  />
                  {itemErrors?.agencyAddress && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.agencyAddress.message ?? "")}
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
