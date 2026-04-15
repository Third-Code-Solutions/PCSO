'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { APPOINTMENT_TYPE_OPTIONS } from '@/lib/constants/appointment-types';
import type { OfficeSelectOption } from '@/app/(dashboard)/employees/queries';

interface EmployeeFiltersProps {
  offices: OfficeSelectOption[];
}

const SALARY_GRADES = Array.from({ length: 33 }, (_, i) => i + 1);

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'resigned', label: 'Resigned' },
  { value: 'retired', label: 'Retired' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'deceased', label: 'Deceased' },
] as const;

export function EmployeeFilters({ offices }: EmployeeFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset to page 1 on filter change
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const hasFilters =
    searchParams.has('search') ||
    searchParams.has('appointmentType') ||
    searchParams.has('officeId') ||
    searchParams.has('status') ||
    searchParams.has('salaryGrade');

  const clearFilters = () => {
    router.push(pathname);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search name, employee no., position…"
          defaultValue={searchParams.get('search') ?? ''}
          className="pl-9"
          onChange={(e) => {
            const val = e.target.value.trim();
            // Debounce via form submit on Enter; live update on clear
            if (!val) updateParam('search', null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = (e.target as HTMLInputElement).value.trim();
              updateParam('search', val || null);
            }
          }}
          aria-label="Search employees"
        />
      </div>

      {/* Appointment type filter */}
      <Select
        value={searchParams.get('appointmentType') ?? 'all'}
        onValueChange={(v) => updateParam('appointmentType', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[180px]" aria-label="Filter by appointment type">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {APPOINTMENT_TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Office filter */}
      <Select
        value={searchParams.get('officeId') ?? 'all'}
        onValueChange={(v) => updateParam('officeId', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[180px]" aria-label="Filter by office">
          <SelectValue placeholder="All offices" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All offices</SelectItem>
          {offices.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select
        value={searchParams.get('status') ?? 'all'}
        onValueChange={(v) => updateParam('status', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[150px]" aria-label="Filter by status">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Salary grade filter */}
      <Select
        value={searchParams.get('salaryGrade') ?? 'all'}
        onValueChange={(v) => updateParam('salaryGrade', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[130px]" aria-label="Filter by salary grade">
          <SelectValue placeholder="All SG" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All SG</SelectItem>
          {SALARY_GRADES.map((sg) => (
            <SelectItem key={sg} value={String(sg)}>
              SG-{sg}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
