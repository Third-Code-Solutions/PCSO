import { db } from '@/lib/db';
import { employees } from '@/lib/db/schema';
import { desc, isNull } from 'drizzle-orm';

/**
 * Generates the next sequential employee number in the format EMP-YYYY-NNNNN.
 * Queries the database for the highest existing employee_no in the current year
 * and increments by 1.
 *
 * Example: EMP-2025-00001, EMP-2025-00002
 */
export async function generateEmployeeNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EMP-${year}-`;

  const rows = await db
    .select({ employeeNo: employees.employeeNo })
    .from(employees)
    .where(isNull(employees.deletedAt))
    .orderBy(desc(employees.employeeNo))
    .limit(50);

  const thisYearRows = rows.filter((r) => r.employeeNo?.startsWith(prefix));

  if (thisYearRows.length === 0) {
    return `${prefix}00001`;
  }

  const highest = thisYearRows.reduce((best, current) => {
    const bestSeq = parseInt(best.employeeNo?.replace(prefix, '') ?? '0', 10);
    const currentSeq = parseInt(current.employeeNo?.replace(prefix, '') ?? '0', 10);
    return currentSeq > bestSeq ? current : best;
  });

  const seq = parseInt(highest.employeeNo?.replace(prefix, '') ?? '0', 10);
  const next = (seq + 1).toString().padStart(5, '0');
  return `${prefix}${next}`;
}

/**
 * Parses an employee number string and returns its components.
 * Returns null if the format does not match EMP-YYYY-NNNNN.
 */
export function parseEmployeeNo(employeeNo: string): {
  prefix: string;
  year: number;
  sequence: number;
} | null {
  const match = /^EMP-(\d{4})-(\d{5})$/.exec(employeeNo);
  if (!match) return null;
  return {
    prefix: 'EMP',
    year: parseInt(match[1], 10),
    sequence: parseInt(match[2], 10),
  };
}
