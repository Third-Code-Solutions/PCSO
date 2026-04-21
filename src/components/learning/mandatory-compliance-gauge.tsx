/**
 * Mandatory Compliance Gauge — shows overall %, color-coded band.
 *
 * Consumed by the Learning overview and mandatory-compliance page.
 */

interface MandatoryComplianceGaugeProps {
  compliantCount: number;
  totalRequired: number;
  label?: string;
  size?: "sm" | "md" | "lg";
}

function toneFor(pct: number): { fill: string; track: string; text: string } {
  if (pct >= 90)
    return {
      fill: "bg-emerald-600",
      track: "bg-emerald-100",
      text: "text-emerald-700",
    };
  if (pct >= 70)
    return {
      fill: "bg-amber-500",
      track: "bg-amber-100",
      text: "text-amber-700",
    };
  return { fill: "bg-red-600", track: "bg-red-100", text: "text-red-700" };
}

export function MandatoryComplianceGauge({
  compliantCount,
  totalRequired,
  label = "Mandatory Compliance",
  size = "md",
}: MandatoryComplianceGaugeProps) {
  const pct =
    totalRequired === 0
      ? 0
      : Math.round((compliantCount / totalRequired) * 100);
  const tone = toneFor(pct);

  const heights: Record<
    NonNullable<MandatoryComplianceGaugeProps["size"]>,
    string
  > = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
  };
  const fontSizes: Record<
    NonNullable<MandatoryComplianceGaugeProps["size"]>,
    string
  > = {
    sm: "text-2xl",
    md: "text-3xl",
    lg: "text-5xl",
  };

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={`${fontSizes[size]} font-bold tabular-nums ${tone.text}`}
        >
          {pct}%
        </span>
        <span className="text-xs text-muted-foreground">
          {compliantCount}/{totalRequired} compliant
        </span>
      </div>
      <div
        className={`mt-3 w-full overflow-hidden rounded-full ${heights[size]} ${tone.track}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`${heights[size]} ${tone.fill} transition-[width] duration-500`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}
