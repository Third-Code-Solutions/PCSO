'use client';

import type { AnomalyFlag } from '@/app/(dashboard)/attendance/queries';

interface AnomalyAlertsProps {
  anomalies: AnomalyFlag[];
  className?: string;
}

const ANOMALY_CONFIG = {
  absent: {
    label: 'Absent',
    icon: '✕',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
  },
  missing_time_in: {
    label: 'Missing Time-In',
    icon: '↑',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
  missing_time_out: {
    label: 'Missing Time-Out',
    icon: '↓',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
  excessive_late: {
    label: 'Excessive Tardiness',
    icon: '!',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    badge: 'bg-orange-100 text-orange-700',
  },
} satisfies Record<AnomalyFlag['type'], object>;

export function AnomalyAlerts({ anomalies, className = '' }: AnomalyAlertsProps) {
  if (anomalies.length === 0) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ${className}`}
      >
        <span className="font-semibold">No anomalies detected</span>
        <span className="text-xs text-emerald-600">
          All records are complete for this period.
        </span>
      </div>
    );
  }

  // Group by type for the summary bar
  const counts: Partial<Record<AnomalyFlag['type'], number>> = {};
  for (const a of anomalies) {
    counts[a.type] = (counts[a.type] ?? 0) + 1;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#0B2545]/10 bg-[#FAF4E6] px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#0B2545]">
          Anomalies ({anomalies.length})
        </span>
        {(Object.entries(counts) as [AnomalyFlag['type'], number][]).map(([type, count]) => {
          const cfg = ANOMALY_CONFIG[type];
          return (
            <span
              key={type}
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.badge}`}
            >
              {cfg.label}: {count}
            </span>
          );
        })}
      </div>

      {/* Individual flags */}
      <div className="max-h-64 overflow-y-auto rounded-lg border border-[#0B2545]/10">
        {anomalies.map((anomaly, idx) => {
          const cfg = ANOMALY_CONFIG[anomaly.type];
          return (
            <div
              key={`${anomaly.employeeId}-${anomaly.date}-${idx}`}
              className={`flex items-start gap-3 border-b px-4 py-2.5 last:border-b-0 ${cfg.bg} ${cfg.border}`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${cfg.badge}`}
              >
                {cfg.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-semibold ${cfg.text}`}>
                    {cfg.label}
                  </span>
                  <span className="font-mono text-xs text-gray-500">
                    {anomaly.date}
                  </span>
                  <span className="font-mono text-xs text-gray-400">
                    EMP:{anomaly.employeeId.slice(0, 8)}
                  </span>
                </div>
                <p className={`mt-0.5 text-xs ${cfg.text}`}>{anomaly.details}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
