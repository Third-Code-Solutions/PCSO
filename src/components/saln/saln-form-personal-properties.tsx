/**
 * SALN Form Section — Personal Properties
 *
 * CSC Form CS-SALN-1 Schedule B: Motor vehicles, jewelry, appliances, etc.
 * Fields: description, year acquired, acquisition cost, current fair market value.
 */

'use client';

import { useFieldArray, useFormContext } from 'react-hook-form';
import { PlusIcon, TrashIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FileSalnInput } from '@/lib/validations/saln';

const currentYear = new Date().getFullYear();

export function SalnFormPersonalProperties() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FileSalnInput>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'personalProperties',
  });

  function addItem() {
    append({
      description: '',
      yearAcquired: currentYear,
      cost: '0.00',
      currentFairMarketValue: '0.00',
    });
  }

  const fieldErrors = errors.personalProperties;

  return (
    <section aria-labelledby="personal-props-heading">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3
            id="personal-props-heading"
            className="text-base font-semibold text-senate-navy"
          >
            B. Personal Properties
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Motor vehicles, jewelry, appliances, and other movable properties.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Add Property
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No personal properties declared. Click &ldquo;Add Property&rdquo; to add one.
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
                  Item {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  aria-label={`Remove item ${index + 1}`}
                  className="text-destructive hover:text-destructive"
                >
                  <TrashIcon className="h-4 w-4" aria-hidden />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Description */}
                <div className="sm:col-span-2">
                  <Label htmlFor={`personalProperties.${index}.description`}>
                    Description
                  </Label>
                  <Input
                    id={`personalProperties.${index}.description`}
                    {...register(`personalProperties.${index}.description`)}
                    placeholder="e.g. 2019 Toyota Vios 1.3 E MT"
                    aria-invalid={!!itemErrors?.description}
                  />
                  {itemErrors?.description && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.description.message ?? '')}
                    </p>
                  )}
                </div>

                {/* Year Acquired */}
                <div>
                  <Label htmlFor={`personalProperties.${index}.yearAcquired`}>
                    Year Acquired
                  </Label>
                  <Input
                    id={`personalProperties.${index}.yearAcquired`}
                    type="number"
                    min={1900}
                    max={currentYear}
                    {...register(`personalProperties.${index}.yearAcquired`, {
                      valueAsNumber: true,
                    })}
                    aria-invalid={!!itemErrors?.yearAcquired}
                  />
                  {itemErrors?.yearAcquired && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.yearAcquired.message ?? '')}
                    </p>
                  )}
                </div>

                {/* Acquisition Cost */}
                <div>
                  <Label htmlFor={`personalProperties.${index}.cost`}>
                    Acquisition Cost (PHP)
                  </Label>
                  <Input
                    id={`personalProperties.${index}.cost`}
                    {...register(`personalProperties.${index}.cost`)}
                    placeholder="0.00"
                    aria-invalid={!!itemErrors?.cost}
                  />
                  {itemErrors?.cost && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.cost.message ?? '')}
                    </p>
                  )}
                </div>

                {/* Current Fair Market Value */}
                <div>
                  <Label htmlFor={`personalProperties.${index}.currentFairMarketValue`}>
                    Current Fair Market Value (PHP)
                  </Label>
                  <Input
                    id={`personalProperties.${index}.currentFairMarketValue`}
                    {...register(`personalProperties.${index}.currentFairMarketValue`)}
                    placeholder="0.00"
                    aria-invalid={!!itemErrors?.currentFairMarketValue}
                  />
                  {itemErrors?.currentFairMarketValue && (
                    <p className="mt-1 text-xs text-destructive">
                      {String(itemErrors.currentFairMarketValue.message ?? '')}
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
