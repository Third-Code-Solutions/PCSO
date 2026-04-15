'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createSalaryGradeSet } from '../actions';

interface GradeStepRow {
  grade: number;
  step: number;
  monthlySalary: string;
}

function buildDefaultRows(): GradeStepRow[] {
  const rows: GradeStepRow[] = [];
  for (let grade = 1; grade <= 33; grade++) {
    for (let step = 1; step <= 8; step++) {
      rows.push({ grade, step, monthlySalary: '' });
    }
  }
  return rows;
}

export default function NewSalaryGradeSetPage() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [effectiveDate, setEffectiveDate] = React.useState('');
  const [rows, setRows] = React.useState<GradeStepRow[]>(buildDefaultRows);

  function updateSalary(grade: number, step: number, value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.grade === grade && r.step === step ? { ...r, monthlySalary: value } : r,
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nonEmpty = rows.filter((r) => r.monthlySalary.trim() !== '');

    if (nonEmpty.length === 0) {
      toast.error('Validation error', { description: 'Enter at least one monthly salary.' });
      return;
    }

    setPending(true);
    try {
      const result = await createSalaryGradeSet({
        effectiveDate,
        rows: nonEmpty.map((r) => ({
          grade: r.grade,
          step: r.step,
          monthlySalary: r.monthlySalary.trim(),
        })),
      });
      toast.success('Salary grade set created', {
        description: `${result.inserted} rows inserted for effective date ${effectiveDate}.`,
      });
      router.push('/admin/salary-grades');
    } catch (err) {
      toast.error('Error', {
        description: err instanceof Error ? err.message : 'Failed to create salary grade set.',
      });
    } finally {
      setPending(false);
    }
  }

  // Group rows by grade for the form grid
  const byGrade = React.useMemo(() => {
    const map = new Map<number, GradeStepRow[]>();
    for (const r of rows) {
      const existing = map.get(r.grade) ?? [];
      map.set(r.grade, [...existing, r]);
    }
    return map;
  }, [rows]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="New Salary Grade Effective Date"
        description="Enter all grade-step monthly salaries for the new SSL effective date. Leave a cell blank to skip it."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin', href: '/admin' },
          { label: 'Salary Grades', href: '/admin/salary-grades' },
          { label: 'New' },
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="max-w-xs space-y-2">
          <Label htmlFor="effectiveDate">Effective Date</Label>
          <Input
            id="effectiveDate"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            All existing rows for this date will be skipped (duplicate protection).
          </p>
        </div>

        <div className="overflow-auto rounded-md border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left font-semibold">Grade</th>
                {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => (
                  <th key={s} className="px-3 py-2 text-right font-semibold">
                    Step {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 33 }, (_, i) => i + 1).map((grade) => {
                const gradeRows = byGrade.get(grade) ?? [];
                const byStep = new Map(gradeRows.map((r) => [r.step, r]));
                return (
                  <tr key={grade} className="border-t border-border">
                    <td className="px-3 py-1 font-semibold text-senate-navy">SG {grade}</td>
                    {Array.from({ length: 8 }, (_, i) => i + 1).map((step) => {
                      const rowData = byStep.get(step);
                      return (
                        <td key={step} className="px-1 py-1">
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={rowData?.monthlySalary ?? ''}
                            onChange={(e) => updateSalary(grade, step, e.target.value)}
                            className="h-7 w-28 text-right font-mono text-xs"
                            aria-label={`SG ${grade} Step ${step} monthly salary`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={pending}
            className="bg-senate-navy text-white hover:bg-senate-navy-light"
          >
            {pending ? 'Saving…' : 'Save grade set'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/salary-grades')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
