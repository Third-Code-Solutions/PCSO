'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EmployeeInput } from '@/lib/validations/employees';

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

function GovIdField({
  name,
  label,
  placeholder,
  hint,
}: {
  name: keyof Pick<EmployeeInput, 'tin' | 'gsisNo' | 'philhealthNo' | 'pagibigNo'>;
  label: string;
  placeholder: string;
  hint: string;
}) {
  const { register } = useFormContext<EmployeeInput>();
  return (
    <div className="space-y-1">
      <Label htmlFor={name} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={name}
        {...register(name)}
        placeholder={placeholder}
        className="font-mono"
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
      <FieldError name={name} />
    </div>
  );
}

export function EmployeeFormGovIds() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        All government ID numbers are optional but required for payroll deductions and statutory
        remittances. Leave blank if not yet available.
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <GovIdField
          name="tin"
          label="Tax Identification Number (TIN)"
          placeholder="###-###-###-###"
          hint="12-digit number with dashes (BIR format)"
        />

        <GovIdField
          name="gsisNo"
          label="GSIS Membership Number"
          placeholder="00000000000"
          hint="11-digit GSIS number"
        />

        <GovIdField
          name="philhealthNo"
          label="PhilHealth ID Number"
          placeholder="000000000000"
          hint="12-digit PhilHealth number"
        />

        <GovIdField
          name="pagibigNo"
          label="Pag-IBIG MID Number"
          placeholder="000000000000"
          hint="12-digit Pag-IBIG number"
        />
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Reminder:</strong> Ensure all government IDs are verified against the employee's
        physical documents before saving. Incorrect IDs will cause remittance mismatches.
      </div>
    </div>
  );
}
