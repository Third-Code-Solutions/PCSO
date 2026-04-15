'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { salaryGrades } from '@/lib/db/schema';
import { requirePermission } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
import { SalaryGradeSetSchema, type SalaryGradeSetInput } from '@/lib/validations/admin';

// ---------------------------------------------------------------------------
// createSalaryGradeSet
//
// Inserts a full set of grade-step rows for a new effective date.
// All rate changes INSERT new rows — historical rows are never modified.
// The payroll engine queries the row with the highest effectiveDate ≤ payroll
// period start.
// ---------------------------------------------------------------------------
export async function createSalaryGradeSet(input: unknown): Promise<{ inserted: number }> {
  const actor = await requirePermission('admin', 'create');
  const parsed: SalaryGradeSetInput = SalaryGradeSetSchema.parse(input);

  const rows = parsed.rows.map((r) => ({
    grade: r.grade,
    step: r.step,
    monthlySalary: r.monthlySalary,
    effectiveDate: parsed.effectiveDate,
  }));

  // Bulk insert — DB unique index (grade, step, effectiveDate) prevents duplicates.
  const inserted = await db
    .insert(salaryGrades)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: salaryGrades.id });

  await auditLog({
    userId: actor.id,
    action: 'create',
    table: 'salary_grades',
    newValues: { effectiveDate: parsed.effectiveDate, rowCount: inserted.length },
  });

  revalidatePath('/admin/salary-grades');
  return { inserted: inserted.length };
}
