/**
 * NetWorthSummary — live-computed net worth panel
 *
 * Watches the SALN form context and recomputes net worth on every change.
 * Uses the same computation logic as the server action to keep UI and DB in sync.
 */

'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { useMemo } from 'react';
import { computeNetWorth, formatPeso } from '@/lib/utils/saln/net-worth';
import type { FileSalnInput, RealAsset, PersonalProperty, Investment, Liability } from '@/lib/validations/saln';
import { cn } from '@/lib/utils/cn';

interface NetWorthSummaryProps {
  className?: string;
}

export function NetWorthSummary({ className }: NetWorthSummaryProps) {
  const { control } = useFormContext<FileSalnInput>();

  const realAssets = useWatch({ control, name: 'realAssets' }) ?? [];
  const personalProperties = useWatch({ control, name: 'personalProperties' }) ?? [];
  const investments = useWatch({ control, name: 'investments' }) ?? [];
  const liabilities = useWatch({ control, name: 'liabilities' }) ?? [];

  const summary = useMemo(() => {
    try {
      return computeNetWorth(
        realAssets as RealAsset[],
        personalProperties as PersonalProperty[],
        investments as Investment[],
        liabilities as Liability[],
      );
    } catch {
      return {
        totalRealAssets: '0.00',
        totalPersonalProperties: '0.00',
        totalInvestments: '0.00',
        totalAssets: '0.00',
        totalLiabilities: '0.00',
        netWorth: '0.00',
      };
    }
  }, [realAssets, personalProperties, investments, liabilities]);

  const netWorthValue = parseFloat(summary.netWorth);
  const isNegative = netWorthValue < 0;

  return (
    <aside
      aria-label="Net Worth Summary"
      className={cn(
        'rounded-lg border border-senate-gold/40 bg-senate-cream p-5',
        className,
      )}
    >
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-senate-navy">
        Net Worth Summary
      </h3>

      {/* Assets breakdown */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Real Properties</span>
          <span className="font-mono text-foreground">
            {formatPeso(summary.totalRealAssets)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Personal Properties</span>
          <span className="font-mono text-foreground">
            {formatPeso(summary.totalPersonalProperties)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Investments</span>
          <span className="font-mono text-foreground">
            {formatPeso(summary.totalInvestments)}
          </span>
        </div>
      </div>

      {/* Total Assets */}
      <div className="my-3 border-t border-senate-gold/30 pt-3">
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-foreground">Total Assets</span>
          <span className="font-mono text-senate-navy">
            {formatPeso(summary.totalAssets)}
          </span>
        </div>
      </div>

      {/* Total Liabilities */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Total Liabilities</span>
        <span className="font-mono text-destructive">
          ({formatPeso(summary.totalLiabilities)})
        </span>
      </div>

      {/* Net Worth */}
      <div className="mt-3 rounded-md bg-senate-navy px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Net Worth</span>
          <span
            className={cn(
              'font-mono text-base font-bold',
              isNegative ? 'text-red-300' : 'text-senate-gold',
            )}
          >
            {formatPeso(summary.netWorth)}
          </span>
        </div>
        <p className="mt-1 text-xs text-white/50">
          Assets minus Liabilities
        </p>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Values update automatically as you fill in the form. The final computed
        value will be stored upon submission.
      </p>
    </aside>
  );
}
