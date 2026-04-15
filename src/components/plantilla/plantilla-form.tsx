'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { PlantillaPositionSchema, type PlantillaPositionInput } from '@/lib/validations/plantilla';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OfficeRow } from '@/app/(dashboard)/plantilla/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlantillaFormProps {
  defaultValues?: Partial<PlantillaPositionInput> & { id?: string };
  offices: Pick<OfficeRow, 'id' | 'name' | 'code'>[];
  /**
   * Server action to call on submit.
   * Must be a server action — import from actions.ts at the page level.
   */
  action: (data: PlantillaPositionInput) => Promise<{ id: string } | void>;
  isEdit?: boolean;
}

// ---------------------------------------------------------------------------
// Salary grade options
// ---------------------------------------------------------------------------

const SALARY_GRADES = Array.from({ length: 33 }, (_, i) => i + 1);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlantillaForm({
  defaultValues,
  offices,
  action,
  isEdit = false,
}: PlantillaFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PlantillaPositionInput>({
    resolver: zodResolver(PlantillaPositionSchema),
    defaultValues: {
      itemNo: defaultValues?.itemNo ?? '',
      positionTitle: defaultValues?.positionTitle ?? '',
      salaryGrade: defaultValues?.salaryGrade ?? 1,
      authorizedSalary: defaultValues?.authorizedSalary ?? '',
      officeId: defaultValues?.officeId ?? '',
      isFilled: defaultValues?.isFilled ?? false,
      employeeId: defaultValues?.employeeId ?? null,
    },
  });

  const selectedOfficeId = watch('officeId');
  const selectedSg = watch('salaryGrade');

  async function handleFormSubmit(data: PlantillaPositionInput) {
    try {
      await action(data);
      toast.success(isEdit ? 'Position updated.' : 'Position created.');
      router.push('/plantilla');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred.';
      toast.error(message);
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Position Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {/* Item No */}
            <div className="space-y-1.5">
              <Label htmlFor="itemNo">
                Item Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="itemNo"
                placeholder="e.g. P-001"
                className="font-mono"
                {...register('itemNo')}
              />
              {errors.itemNo && (
                <p className="text-xs text-destructive">{errors.itemNo.message}</p>
              )}
            </div>

            {/* Position Title */}
            <div className="space-y-1.5">
              <Label htmlFor="positionTitle">
                Position Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="positionTitle"
                placeholder="e.g. Administrative Officer III"
                {...register('positionTitle')}
              />
              {errors.positionTitle && (
                <p className="text-xs text-destructive">{errors.positionTitle.message}</p>
              )}
            </div>

            {/* Salary Grade */}
            <div className="space-y-1.5">
              <Label htmlFor="salaryGrade">
                Salary Grade <span className="text-destructive">*</span>
              </Label>
              <Select
                value={String(selectedSg)}
                onValueChange={(v) => setValue('salaryGrade', parseInt(v, 10))}
              >
                <SelectTrigger id="salaryGrade">
                  <SelectValue placeholder="Select SG" />
                </SelectTrigger>
                <SelectContent>
                  {SALARY_GRADES.map((sg) => (
                    <SelectItem key={sg} value={String(sg)}>
                      SG-{sg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.salaryGrade && (
                <p className="text-xs text-destructive">{errors.salaryGrade.message}</p>
              )}
            </div>

            {/* Authorized Salary */}
            <div className="space-y-1.5">
              <Label htmlFor="authorizedSalary">
                Authorized Salary (₱) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="authorizedSalary"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 25000.00"
                className="font-mono"
                {...register('authorizedSalary')}
              />
              {errors.authorizedSalary && (
                <p className="text-xs text-destructive">{errors.authorizedSalary.message}</p>
              )}
            </div>

            {/* Office */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="officeId">
                Office <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedOfficeId}
                onValueChange={(v) => setValue('officeId', v)}
              >
                <SelectTrigger id="officeId">
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((office) => (
                    <SelectItem key={office.id} value={office.id}>
                      {office.name}
                      <span className="ml-2 text-muted-foreground text-xs">
                        ({office.code})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.officeId && (
                <p className="text-xs text-destructive">{errors.officeId.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? isEdit
                ? 'Saving…'
                : 'Creating…'
              : isEdit
                ? 'Save Changes'
                : 'Create Position'}
          </Button>
        </div>
      </div>
    </form>
  );
}
