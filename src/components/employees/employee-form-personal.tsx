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
import { GENDER_OPTIONS } from '@/lib/constants/gender';
import { CIVIL_STATUS_OPTIONS } from '@/lib/constants/civil-status';
import { BLOOD_TYPE_OPTIONS } from '@/lib/constants/blood-types';
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

export function EmployeeFormPersonal() {
  const { register, setValue, watch } = useFormContext<EmployeeInput>();

  return (
    <div className="space-y-6">
      {/* Name row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField name="firstName" label="First Name" required>
          <Input id="firstName" {...register('firstName')} placeholder="Juan" />
        </FormField>
        <FormField name="middleName" label="Middle Name">
          <Input id="middleName" {...register('middleName')} placeholder="Santos" />
        </FormField>
        <FormField name="lastName" label="Last Name" required>
          <Input id="lastName" {...register('lastName')} placeholder="dela Cruz" />
        </FormField>
        <FormField name="suffix" label="Suffix">
          <Input id="suffix" {...register('suffix')} placeholder="Jr., III…" />
        </FormField>
      </div>

      {/* Demographics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FormField name="birthDate" label="Date of Birth" required>
          <Input id="birthDate" type="date" {...register('birthDate')} />
        </FormField>

        <FormField name="gender" label="Gender" required>
          <Select
            value={watch('gender') ?? ''}
            onValueChange={(v) =>
              setValue('gender', v as EmployeeInput['gender'], { shouldValidate: true })
            }
          >
            <SelectTrigger id="gender">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              {GENDER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField name="civilStatus" label="Civil Status" required>
          <Select
            value={watch('civilStatus') ?? ''}
            onValueChange={(v) =>
              setValue('civilStatus', v as EmployeeInput['civilStatus'], { shouldValidate: true })
            }
          >
            <SelectTrigger id="civilStatus">
              <SelectValue placeholder="Select civil status" />
            </SelectTrigger>
            <SelectContent>
              {CIVIL_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField name="nationality" label="Nationality">
          <Input id="nationality" {...register('nationality')} placeholder="Filipino" />
        </FormField>

        <FormField name="religion" label="Religion">
          <Input id="religion" {...register('religion')} placeholder="Roman Catholic" />
        </FormField>

        <FormField name="bloodType" label="Blood Type">
          <Select
            value={watch('bloodType') ?? ''}
            onValueChange={(v) =>
              setValue('bloodType', v as EmployeeInput['bloodType'], { shouldValidate: true })
            }
          >
            <SelectTrigger id="bloodType">
              <SelectValue placeholder="Select blood type" />
            </SelectTrigger>
            <SelectContent>
              {BLOOD_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField name="email" label="Email Address">
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder="juan@senate.gov.ph"
          />
        </FormField>
        <FormField name="phone" label="Mobile Number">
          <Input id="phone" {...register('phone')} placeholder="+639XXXXXXXXX or 09XXXXXXXXX" />
        </FormField>
      </div>

      {/* Permanent address */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Permanent Address
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField name="permanentAddressStreet" label="Street / House No.">
            <Input id="permanentAddressStreet" {...register('permanentAddressStreet')} />
          </FormField>
          <FormField name="permanentAddressBarangay" label="Barangay">
            <Input id="permanentAddressBarangay" {...register('permanentAddressBarangay')} />
          </FormField>
          <FormField name="permanentAddressCity" label="City / Municipality">
            <Input id="permanentAddressCity" {...register('permanentAddressCity')} />
          </FormField>
          <FormField name="permanentAddressProvince" label="Province">
            <Input id="permanentAddressProvince" {...register('permanentAddressProvince')} />
          </FormField>
          <FormField name="permanentAddressZip" label="ZIP Code">
            <Input id="permanentAddressZip" {...register('permanentAddressZip')} />
          </FormField>
        </div>
      </section>

      {/* Current address */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Current Address{' '}
          <span className="text-xs normal-case font-normal">(if different from permanent)</span>
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField name="currentAddressStreet" label="Street / House No.">
            <Input id="currentAddressStreet" {...register('currentAddressStreet')} />
          </FormField>
          <FormField name="currentAddressBarangay" label="Barangay">
            <Input id="currentAddressBarangay" {...register('currentAddressBarangay')} />
          </FormField>
          <FormField name="currentAddressCity" label="City / Municipality">
            <Input id="currentAddressCity" {...register('currentAddressCity')} />
          </FormField>
          <FormField name="currentAddressProvince" label="Province">
            <Input id="currentAddressProvince" {...register('currentAddressProvince')} />
          </FormField>
          <FormField name="currentAddressZip" label="ZIP Code">
            <Input id="currentAddressZip" {...register('currentAddressZip')} />
          </FormField>
        </div>
      </section>

      {/* Emergency contact */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Emergency Contact
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField name="emergencyContactName" label="Name">
            <Input id="emergencyContactName" {...register('emergencyContactName')} />
          </FormField>
          <FormField name="emergencyContactRelation" label="Relationship">
            <Input id="emergencyContactRelation" {...register('emergencyContactRelation')} />
          </FormField>
          <FormField name="emergencyContactPhone" label="Mobile Number">
            <Input
              id="emergencyContactPhone"
              {...register('emergencyContactPhone')}
              placeholder="+639XXXXXXXXX or 09XXXXXXXXX"
            />
          </FormField>
        </div>
      </section>
    </div>
  );
}
