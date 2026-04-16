'use server';

import { revalidatePath } from 'next/cache';
import { salaryGrades } from '@/lib/db/schema';
import { requirePermission } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
import { withTx } from '@/lib/db/transaction';
import { lockKey } from '@/lib/concurrency';
import { SalaryGradeSetSchema, type SalaryGradeSetInput } from '@/lib/validations/admin';

const SALARY_GRADE_INSERT_CHUNK = 200;

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

  // One transaction for the whole set. Advisory lock on effectiveDate so
  // two admins seeding the same SSL revision simultaneously serialize —
  // the second one either sees all their rows already present (no-ops via
  // onConflictDoNothing) or inserts the remainder cleanly. Chunked insert
  // for SSL-sized sets (33 grades × 8 steps = 264 rows).
  const inserted = await withTx(async (tx) => {
    await lockKey(tx, `admin:salary-grades:${parsed.effectiveDate}`);

    let total = 0;
    for (let i = 0; i < rows.length; i += SALARY_GRADE_INSERT_CHUNK) {
      const chunk = rows.slice(i, i + SALARY_GRADE_INSERT_CHUNK);
      const ins = await tx
        .insert(salaryGrades)
        .values(chunk)
        .onConflictDoNothing()
        .returning({ id: salaryGrades.id });
      total += ins.length;
    }
    return total;
  });

  void auditLog({
    userId: actor.id,
    action: 'create',
    table: 'salary_grades',
    newValues: { effectiveDate: parsed.effectiveDate, rowCount: inserted },
  });

  revalidatePath('/admin/salary-grades');
  return { inserted };
}
