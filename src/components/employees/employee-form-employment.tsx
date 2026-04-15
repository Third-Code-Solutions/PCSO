'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { APPOINTMENT_TYPE_OPTIONS } from '@/lib/constants/appointment-types';
import type { EmployeeInput } from '@/lib/validations/employees';
import type { OfficeSelectOption } from '@/app/(dashboard)/employees/queries';

const SALARY_GRADES = Array.from({ length: 33 }, (_, i) => i + 1);
const STEPS = Array.from({ length: 8 }, (_, i) => i + 1);

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'resigned', label: 'Resigned' },
  { value: 'retired', label: 'Retired' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'deceased', label: 'Deceased' },
] as const;

function FieldError({ name }: { name: string }) {
  const {
    formState: { errors },
  } = useFormContext<EmployeeInput>();
  const error = errors[name as keyof EmployeeInput];
  if (!error?.message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-destructive">
      {String(error.message)}
    </p>
  );
}

function FormField({
  name,
  label,
  required,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      <FieldError name={name} />
    </div>
  );
}

interface EmployeeFormEmploymentProps {
  offices: OfficeSelectOption[];
  isEdit?: boolean;
}

export function EmployeeFormEmployment({ offices, isEdit = false }: EmployeeFormEmploymentProps) {
  const { register, setValue, watch } = useFormContext<EmployeeInput>();
  const appointmentType = watch('appointmentType');
  const isPermanent = appointmentType === 'permanent';

  return (
    <div className="space-y-6">
      {/* Employee No — read-only on edit, hidden on create (auto-generated) */}
      {isEdit && (
        <FormField name="employeeNo" label="Employee No.">
          <Input
            id="employeeNo"
            {...register('employeeNo')}
            readOnly
            className="font-mono bg-muted"
          />
        </FormField>
      )}

      {/* Appointment */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField name="appointmentType" label="Appointment Type" required>
          <Select
            value={watch('appointmentType') ?? ''}
            onValueChange={(v) =>
              setValue('appointmentType', v as EmployeeInput['appointmentType'], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger id="appointmentType">
              <SelectValue placeholder="Select appointment type" />
            </SelectTrigger>
            <SelectContent>
              {APPOINTMENT_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField name="status" label="Status" required>
          <Select
            value={watch('status') ?? 'active'}
            onValueChange={(v) =>
              setValue('status', v as EmployeeInput['status'], { shouldValidate: true })
            }
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {/* Position */}
      <FormField name="positionTitle" label="Position Title" required>
        <Input
          id="positionTitle"
          {...register('positionTitle')}
          placeholder="Administrative Officer III"
        />
      </FormField>

      {/* SG and Step */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-2">
          <FormField name="salaryGrade" label="Salary Grade" required>
            <Select
              value={String(watch('salaryGrade') ?? '')}
              onValueChange={(v) =>
                setValue('salaryGrade', Number(v), { shouldValidate: true })
              }
            >
              <SelectTrigger id="salaryGrade">
                <SelectValue placeholder="SG" />
              </SelectTrigger>
              <SelectContent>
                {SALARY_GRADES.map((sg) => (
                  <SelectItem key={sg} value={String(sg)}>
                    SG-{sg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <div className="col-span-2 sm:col-span-2">
          <FormField name="step" label="Step" required>
            <Select
              value={String(watch('step') ?? '')}
              onValueChange={(v) => setValue('step', Number(v), { shouldValidate: true })}
            >
              <SelectTrigger id="step">
                <SelectValue placeholder="Step" />
              </SelectTrigger>
              <SelectContent>
                {STEPS.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    Step {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </div>

      {/* Office */}
      <FormField name="officeId" label="Office / Division" required>
        <Select
          value={watch('officeId') ?? ''}
          onValueChange={(v) => setValue('officeId', v, { shouldValidate: true })}
        >
          <SelectTrigger id="officeId">
            <SelectValue placeholder="Select office" />
          </SelectTrigger>
          <SelectContent>
            {offices.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name} ({o.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {/* Dates */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField name="dateHired" label="Date Hired" required>
          <Input id="dateHired" type="date" {...register('dateHired')} />
        </FormField>

        {isPermanent && (
          <FormField name="dateRegularized" label="Date Regularized" required>
            <Input id="dateRegularized" type="date" {...register('dateRegularized')} />
          </FormField>
        )}
      </div>
    </div>
  );
}
