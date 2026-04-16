'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createSalaryGradeSet } from '../actions';

interface SeedRow {
  grade: number;
  step: number;
  monthlySalary: string;
}

interface SeedOption {
  effectiveDate: string;
  rows: SeedRow[];
}

interface GradeStepRow {
  grade: number;
  step: number;
  monthlySalary: string;
}

function buildEmptyRows(): GradeStepRow[] {
  const rows: GradeStepRow[] = [];
  for (let grade = 1; grade <= 33; grade++) {
    for (let step = 1; step <= 8; step++) {
      rows.push({ grade, step, monthlySalary: '' });
    }
  }
  return rows;
}

function seedFrom(option: SeedOption): GradeStepRow[] {
  const byKey = new Map<string, string>();
  for (const r of option.rows) {
    byKey.set(`${r.grade}-${r.step}`, r.monthlySalary);
  }
  return buildEmptyRows().map((r) => ({
    ...r,
    monthlySalary: byKey.get(`${r.grade}-${r.step}`) ?? '',
  }));
}

export function NewSalaryGradeSetForm({ seeds }: { seeds: SeedOption[] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [effectiveDate, setEffectiveDate] = React.useState('');
  const [seedDate, setSeedDate] = React.useState('');
  const [rows, setRows] = React.useState<GradeStepRow[]>(buildEmptyRows);

  function applySeed(date: string) {
    setSeedDate(date);
    if (date === '') {
      setRows(buildEmptyRows());
      return;
    }
    const option = seeds.find((s) => s.effectiveDate === date);
    if (option) setRows(seedFrom(option));
  }

  function applyPercentBump(percent: number) {
    const factor = 1 + percent / 100;
    setRows((prev) =>
      prev.map((r) => {
        if (!r.monthlySalary) return r;
        const n = parseFloat(r.monthlySalary);
        if (Number.isNaN(n)) return r;
        return { ...r, monthlySalary: (n * factor).toFixed(2) };
      }),
    );
    toast.success(`Applied ${percent > 0 ? '+' : ''}${percent}% across all filled cells`);
  }

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
    if (!effectiveDate) {
      toast.error('Validation error', { description: 'Effective date is required.' });
      return;
    }
    if (!window.confirm(
      `Insert ${nonEmpty.length} row(s) with effective date ${effectiveDate}?\n\n` +
        'Existing rows for this date will be skipped automatically.',
    )) {
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
        description: `${result.inserted} rows inserted for ${effectiveDate}.`,
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

  const byGrade = React.useMemo(() => {
    const map = new Map<number, GradeStepRow[]>();
    for (const r of rows) {
      const existing = map.get(r.grade) ?? [];
      map.set(r.grade, [...existing, r]);
    }
    return map;
  }, [rows]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="effectiveDate">Effective Date</Label>
          <Input
            id="effectiveDate"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Existing rows for this date will be skipped (duplicate protection).
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="seedDate">Seed from existing</Label>
          <select
            id="seedDate"
            value={seedDate}
            onChange={(e) => applySeed(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">None (start blank)</option>
            {seeds.map((s) => (
              <option key={s.effectiveDate} value={s.effectiveDate}>
                {s.effectiveDate} ({s.rows.length} rows)
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Prefill all cells from a prior effective date, then edit as needed.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Bulk percent bump</Label>
          <div className="flex gap-1">
            {[3, 5, 10].map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyPercentBump(p)}
                disabled={rows.every((r) => !r.monthlySalary)}
              >
                +{p}%
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Multiplies every filled cell by the chosen percentage. Undo by re-seeding.
          </p>
        </div>
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
  );
}
