/**
 * SALN Form Section — Liabilities
 *
 * CSC Form CS-SALN-1 Schedule D: Loans, mortgages, and other obligations.
 * Fields: nature, creditor, outstanding balance.
 */

"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { PlusIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FileSalnInput } from "@/lib/validations/saln";

const LIABILITY_TYPES = [
  "Housing Loan",
  "Car Loan",
  "Personal Loan",
  "Business Loan",
  "GSIS Loan",
  "Pag-IBIG Loan",
  "SSS Loan",
  "Credit Card",
  "Mortgage",
  "Other",
];

export function SalnFormLiabilities() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FileSalnInput>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "liabilities",
  });

  function addItem() {
    append({
      nature: "",
      creditor: "",
      outstandingBalance: "0.00",
    });
  }

  const fieldErrors = errors.liabilities;

  return (
    <section aria-labelledby="liabilities-heading">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3
            id="liabilities-heading"
            className="text-base font-semibold text-pcso-navy"
          >
            D. Liabilities
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            All outstanding loans, mortgages, and other financial obligations.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Add Liability
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No liabilities declared. Click &ldquo;Add Liability&rdquo; to add one.
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
                  Liability {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  aria-label={`Remove liability ${index + 1}`}
                  className="text-destructive hover:text-destructive"
                >
                  <TrashIcon className="h-4 w-4" aria-hidden />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Nature */}
                <div>
                  <Label htmlFor={`liabilities.${index}.nature`}>
                    Nature of Liability
                  </Label>
                  <Input
                    id={`liabilities.${index}.nature`}
                    {...register(`liabilities.${index}.nature`)}
                    placeholder="e.g. Housing Loan"
                    list={`liability-types-${index}`}
                    aria-invalid={!!itemErrors?.nature}
                  />
                  <datalist id={`liability-types-${index}`}>
                    {LIABILITY_TYPES.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  {itemErrors?.nature && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.nature.message ?? "")}
                    </p>
                  )}
                </div>

                {/* Creditor */}
                <div>
                  <Label htmlFor={`liabilities.${index}.creditor`}>
                    Name of Creditor
                  </Label>
                  <Input
                    id={`liabilities.${index}.creditor`}
                    {...register(`liabilities.${index}.creditor`)}
                    placeholder="e.g. GSIS, BDO Bank"
                    aria-invalid={!!itemErrors?.creditor}
                  />
                  {itemErrors?.creditor && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.creditor.message ?? "")}
                    </p>
                  )}
                </div>

                {/* Outstanding Balance */}
                <div className="sm:col-span-2">
                  <Label htmlFor={`liabilities.${index}.outstandingBalance`}>
                    Outstanding Balance (PHP)
                  </Label>
                  <Input
                    id={`liabilities.${index}.outstandingBalance`}
                    {...register(`liabilities.${index}.outstandingBalance`)}
                    placeholder="0.00"
                    aria-invalid={!!itemErrors?.outstandingBalance}
                  />
                  {itemErrors?.outstandingBalance && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.outstandingBalance.message ?? "")}
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
