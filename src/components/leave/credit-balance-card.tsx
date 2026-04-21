/**
 * CreditBalanceCard — displays VL/SL balances for a single employee.
 * Used on /leave/credits and as a live preview inside the apply form.
 */

"use client";

import { cn } from "@/lib/utils/cn";

interface CreditBalanceCardProps {
  vlBalance: number;
  slBalance: number;
  year: number;
  /** Whether the balance is being refreshed (e.g., on date change in the apply form). */
  isLoading?: boolean;
  /** If provided, shows how many days would be consumed by a pending application. */
  pendingVlDeduction?: number;
  pendingSlDeduction?: number;
  className?: string;
}

interface BalanceBarProps {
  label: string;
  balance: number;
  earned: number;
  pending?: number;
  colorClass: string;
  pendingColorClass: string;
}

function BalanceBar({
  label,
  balance,
  earned,
  pending = 0,
  colorClass,
  pendingColorClass,
}: BalanceBarProps) {
  const remaining = Math.max(0, balance - pending);
  const percentFilled =
    earned > 0 ? Math.min(100, (balance / earned) * 100) : 0;
  const percentPending =
    earned > 0 ? Math.min(100, (pending / earned) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {pending > 0 && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
              -{pending.toFixed(3)} pending
            </span>
          )}
          <span className="font-semibold text-foreground tabular-nums">
            {remaining.toFixed(3)} days
          </span>
        </div>
      </div>
      {/* Track */}
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {/* Filled portion */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all",
            colorClass,
          )}
          style={{ width: `${percentFilled}%` }}
          role="presentation"
        />
        {/* Pending deduction overlay */}
        {percentPending > 0 && (
          <div
            className={cn(
              "absolute inset-y-0 rounded-full transition-all",
              pendingColorClass,
            )}
            style={{
              left: `${Math.max(0, percentFilled - percentPending)}%`,
              width: `${percentPending}%`,
            }}
            role="presentation"
          />
        )}
      </div>
      {earned > 0 && (
        <p className="text-right text-xs text-muted-foreground">
          of {earned.toFixed(3)} earned this year
        </p>
      )}
    </div>
  );
}

export function CreditBalanceCard({
  vlBalance,
  slBalance,
  year,
  isLoading = false,
  pendingVlDeduction = 0,
  pendingSlDeduction = 0,
  className,
}: CreditBalanceCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-opacity",
        isLoading && "opacity-60 pointer-events-none",
        className,
      )}
    >
      {/* Gold accent stripe */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pcso-gold to-pcso-gold-light rounded-t-xl" />

      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Leave Credit Balance
          </h3>
          <p className="text-xs text-muted-foreground">As of {year}</p>
        </div>
        {isLoading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-pcso-navy border-t-transparent" />
        )}
      </div>

      <div className="space-y-5">
        <BalanceBar
          label="Vacation Leave (VL)"
          balance={vlBalance}
          earned={15} // Full year earned max
          pending={pendingVlDeduction}
          colorClass="bg-pcso-navy"
          pendingColorClass="bg-amber-400/70"
        />
        <BalanceBar
          label="Sick Leave (SL)"
          balance={slBalance}
          earned={15}
          pending={pendingSlDeduction}
          colorClass="bg-emerald-600"
          pendingColorClass="bg-amber-400/70"
        />
      </div>

      {/* Summary row */}
      <div className="mt-4 border-t pt-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">VL Balance</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-pcso-navy">
              {Math.max(0, vlBalance - pendingVlDeduction).toFixed(3)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">SL Balance</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-700">
              {Math.max(0, slBalance - pendingSlDeduction).toFixed(3)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
