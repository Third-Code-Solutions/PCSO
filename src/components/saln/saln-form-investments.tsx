/**
 * SALN Form Section — Investments / Financial Assets
 *
 * CSC Form CS-SALN-1 Schedule C: Bank deposits, stocks, bonds, etc.
 * Fields: institution, type, year, amount.
 */

'use client';

import { useFieldArray, useFormContext } from 'react-hook-form';
import { PlusIcon, TrashIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FileSalnInput } from '@/lib/validations/saln';

const INVESTMENT_TYPES = [
  'Bank Deposit / Savings',
  'Time Deposit',
  'Stocks / Equities',
  'Mutual Fund',
  'UITF',
  'Government Bonds',
  'Corporate Bonds',
  'Insurance / Annuity',
  'GSIS Contributions',
  'Pag-IBIG Contributions',
  'Pension Fund',
  'Other',
];

const currentYear = new Date().getFullYear();

export function SalnFormInvestments() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FileSalnInput>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'investments',
  });

  function addItem() {
    append({
      institution: '',
      type: '',
      year: currentYear,
      amount: '0.00',
    });
  }

  const fieldErrors = errors.investments;

  return (
    <section aria-labelledby="investments-heading">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3
            id="investments-heading"
            className="text-base font-semibold text-senate-navy"
          >
            C. Investments / Financial Assets
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Bank deposits, stocks, bonds, insurance proceeds, and other financial instruments.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Add Investment
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No investments declared. Click &ldquo;Add Investment&rdquo; to add one.
        </p>
      )}

      <div className="space-y-4">
        {fields.map((field, index) => {
          const itemErrors = Array.isArray(fieldErrors) ? fieldErrors[index] : undefined;

          return (
            <div
              key={field.id}
              className="rounded-md border border-border bg-card p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  Investment {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  aria-label={`Remove investment ${index + 1}`}
                  className="text-destructive hover:text-destructive"
                >
                  <TrashIcon className="h-4 w-4" aria-hidden />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Institution */}
                <div>
                  <Label htmlFor={`investments.${index}.institution`}>
                    Institution / Company
                  </Label>
                  <Input
                    id={`investments.${index}.institution`}
                    {...register(`investments.${index}.institution`)}
                    placeholder="e.g. BDO Unibank, Inc."
                    aria-invalid={!!itemErrors?.institution}
                  />
                  {itemErrors?.institution && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.institution.message ?? '')}
                    </p>
                  )}
                </div>

                {/* Type */}
                <div>
                  <Label htmlFor={`investments.${index}.type`}>
                    Type of Investment
                  </Label>
                  <Input
                    id={`investments.${index}.type`}
                    {...register(`investments.${index}.type`)}
                    placeholder="e.g. Bank Deposit / Savings"
                    list={`investment-types-${index}`}
                    aria-invalid={!!itemErrors?.type}
                  />
                  <datalist id={`investment-types-${index}`}>
                    {INVESTMENT_TYPES.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  {itemErrors?.type && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.type.message ?? '')}
                    </p>
                  )}
                </div>

                {/* Year */}
                <div>
                  <Label htmlFor={`investments.${index}.year`}>Year</Label>
                  <Input
                    id={`investments.${index}.year`}
                    type="number"
                    min={1900}
                    max={currentYear}
                    {...register(`investments.${index}.year`, { valueAsNumber: true })}
                    aria-invalid={!!itemErrors?.year}
                  />
                  {itemErrors?.year && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.year.message ?? '')}
                    </p>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <Label htmlFor={`investments.${index}.amount`}>
                    Amount (PHP)
                  </Label>
                  <Input
                    id={`investments.${index}.amount`}
                    {...register(`investments.${index}.amount`)}
                    placeholder="0.00"
                    aria-invalid={!!itemErrors?.amount}
                  />
                  {itemErrors?.amount && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.amount.message ?? '')}
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
