'use client';

/**
 * _client.tsx — client-interactive controls for /leave/credits
 *
 * Exports:
 *  - YearSelector:     year <select> that navigates via URL ?year=
 *  - EmployeePicker:   employee <select> for admin (navigates via ?employeeId=)
 *  - PrintLeaveCard:   button that downloads the CSC Form 6 (CSV)
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import {
  LeaveCardDownloader,
} from '@/components/leave/leave-card-downloader';
import type { LeaveCardProps } from '@/components/leave/leave-card';

// ---------------------------------------------------------------------------
// YearSelector
// ---------------------------------------------------------------------------

interface YearSelectorProps {
  currentYear: number;
  /** Earliest selectable year (hire year or a reasonable floor). */
  minYear: number;
  /** Currently selected year. */
  selectedYear: number;
  /** employeeId param to preserve during year navigation. */
  employeeId?: string | null;
}

export function YearSelector({
  currentYear,
  minYear,
  selectedYear,
  employeeId,
}: YearSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const years: number[] = [];
  for (let y = currentYear; y >= minYear; y--) {
    years.push(y);
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('year', e.target.value);
      if (employeeId) params.set('employeeId', employeeId);
      else params.delete('employeeId');
      router.push(`?${params.toString()}`);
    },
    [router, searchParams, employeeId],
  );

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="year-selector"
        className="text-sm font-medium text-muted-foreground whitespace-nowrap"
      >
        Year
      </label>
      <select
        id="year-selector"
        value={selectedYear}
        onChange={handleChange}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-senate-gold"
        aria-label="Select year"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmployeePicker (admin only)
// ---------------------------------------------------------------------------

export interface EmployeeOption {
  id: string;
  employeeNo: string;
  fullName: string;
}

interface EmployeePickerProps {
  employees: EmployeeOption[];
  selectedEmployeeId: string;
  selectedYear: number;
}

export function EmployeePicker({
  employees,
  selectedEmployeeId,
  selectedYear,
}: EmployeePickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('employeeId', e.target.value);
      params.set('year', String(selectedYear));
      router.push(`?${params.toString()}`);
    },
    [router, searchParams, selectedYear],
  );

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="employee-picker"
        className="text-sm font-medium text-muted-foreground whitespace-nowrap"
      >
        Employee
      </label>
      <select
        id="employee-picker"
        value={selectedEmployeeId}
        onChange={handleChange}
        className="h-9 min-w-56 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-senate-gold"
        aria-label="Select employee"
      >
        {employees.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.fullName} ({emp.employeeNo})
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PrintLeaveCard — CSV download (React-19 safe; no @react-pdf/renderer)
// ---------------------------------------------------------------------------

interface PrintLeaveCardProps {
  leaveCardProps: LeaveCardProps;
}

export function PrintLeaveCard({ leaveCardProps }: PrintLeaveCardProps) {
  return <LeaveCardDownloader leaveCardProps={leaveCardProps} />;
}
