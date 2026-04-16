'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { createBirTaxTableSet } from '../actions';

interface BracketRow {
  bracketFrom: string;
  bracketTo: string;
  baseTax: string;
  excessRate: string;
}

const DEFAULT_BRACKETS: BracketRow[] = [
  { bracketFrom: '0', bracketTo: '10417', baseTax: '0', excessRate: '0' },
  { bracketFrom: '10417', bracketTo: '16667', baseTax: '0', excessRate: '0.15' },
  { bracketFrom: '16667', bracketTo: '33333', baseTax: '937.50', excessRate: '0.20' },
  { bracketFrom: '33333', bracketTo: '83333', baseTax: '4270.83', excessRate: '0.25' },
  { bracketFrom: '83333', bracketTo: '333333', baseTax: '16770.83', excessRate: '0.30' },
  { bracketFrom: '333333', bracketTo: '', baseTax: '91770.83', excessRate: '0.35' },
];

export function BirTaxTableForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [effectiveDate, setEffectiveDate] = React.useState('');
  const [periodType, setPeriodType] = React.useState<'semi_monthly' | 'monthly'>('semi_monthly');
  const [brackets, setBrackets] = React.useState<BracketRow[]>(DEFAULT_BRACKETS);

  function updateBracket(index: number, field: keyof BracketRow, value: string) {
    setBrackets((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)),
    );
  }

  function addBracket() {
    setBrackets((prev) => [
      ...prev,
      { bracketFrom: '', bracketTo: '', baseTax: '0', excessRate: '0' },
    ]);
  }

  function removeBracket(index: number) {
    setBrackets((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!effectiveDate) {
      toast.error('Validation error', { description: 'Effective date is required.' });
      return;
    }

    if (!window.confirm(
      `Insert a new BIR ${periodType.replace('_', '-')} tax table effective ${effectiveDate}?\n\n` +
        `${brackets.length} bracket(s) will be inserted. This change is permanent and affects all payroll periods on or after this date.`,
    )) {
      return;
    }

    setPending(true);
    try {
      const result = await createBirTaxTableSet({
        effectiveDate,
        periodType,
        brackets: brackets.map((b) => ({
          bracketFrom: b.bracketFrom,
          bracketTo: b.bracketTo !== '' ? b.bracketTo : null,
          baseTax: b.baseTax,
          excessRate: b.excessRate,
        })),
      });
      toast.success('BIR tax table saved', {
        description: `${result.inserted} brackets inserted.`,
      });
      router.refresh();
    } catch (err) {
      toast.error('Error', {
        description: err instanceof Error ? err.message : 'Failed to save BIR tax table.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New BIR Tax Table</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bir-date">Effective Date</Label>
              <Input
                id="bir-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bir-period">Period Type</Label>
              <Select
                value={periodType}
                onValueChange={(v) => setPeriodType(v as 'semi_monthly' | 'monthly')}
              >
                <SelectTrigger id="bir-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semi_monthly">Semi-Monthly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bracket rows */}
          <div className="overflow-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Bracket From (₱)</th>
                  <th className="px-3 py-2 text-left">Bracket To (₱, blank = no limit)</th>
                  <th className="px-3 py-2 text-left">Base Tax (₱)</th>
                  <th className="px-3 py-2 text-left">Excess Rate (decimal)</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {brackets.map((b, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1">
                      <Input
                        value={b.bracketFrom}
                        onChange={(e) => updateBracket(i, 'bracketFrom', e.target.value)}
                        placeholder="0"
                        required
                        className="h-7 text-xs font-mono"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        value={b.bracketTo}
                        onChange={(e) => updateBracket(i, 'bracketTo', e.target.value)}
                        placeholder="(no limit)"
                        className="h-7 text-xs font-mono"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        value={b.baseTax}
                        onChange={(e) => updateBracket(i, 'baseTax', e.target.value)}
                        placeholder="0"
                        required
                        className="h-7 text-xs font-mono"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        value={b.excessRate}
                        onChange={(e) => updateBracket(i, 'excessRate', e.target.value)}
                        placeholder="0"
                        required
                        className="h-7 text-xs font-mono"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBracket(i)}
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label="Remove bracket"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addBracket}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add bracket
            </Button>
          </div>

          <Button
            type="submit"
            disabled={pending}
            className="bg-senate-navy text-white hover:bg-senate-navy-light"
          >
            {pending ? 'Saving…' : 'Save tax table'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
