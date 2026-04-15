/**
 * RatingInput — numerical input (1.000–5.000) with live auto-adjectival preview.
 *
 * Updates the adjectival label in real time as the user types, using CSC bands.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { ratingToAdjectival } from '@/lib/utils/performance/rating';
import { RATING_BANDS, MIN_RATING, MAX_RATING } from '@/lib/constants/performance';
import type { AdjectivalRating } from '@/lib/constants/performance';

interface RatingInputProps {
  id?: string;
  value: number | '';
  onChange: (value: number | '') => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  showAdjectival?: boolean;
}

const ADJECTIVAL_COLOR: Record<AdjectivalRating, string> = {
  outstanding: 'text-emerald-700 bg-emerald-50',
  very_satisfactory: 'text-blue-700 bg-blue-50',
  satisfactory: 'text-amber-700 bg-amber-50',
  unsatisfactory: 'text-orange-700 bg-orange-50',
  poor: 'text-red-700 bg-red-50',
};

export function RatingInput({
  id,
  value,
  onChange,
  disabled = false,
  className,
  label,
  showAdjectival = true,
}: RatingInputProps) {
  const numerical = typeof value === 'number' ? value : null;
  const adjectival = numerical !== null ? ratingToAdjectival(numerical) : null;
  const isOutOfRange =
    numerical !== null && (numerical < MIN_RATING || numerical > MAX_RATING);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === '') {
      onChange('');
      return;
    }
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
        >
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.001"
          min={MIN_RATING}
          max={MAX_RATING}
          value={value === '' ? '' : value}
          onChange={handleChange}
          disabled={disabled}
          aria-label={label ?? 'Rating input'}
          aria-describedby={showAdjectival && adjectival ? `${id}-adjectival` : undefined}
          className={cn(
            'w-24 rounded-md border px-2.5 py-1.5 text-sm font-tabular-nums',
            'focus:outline-none focus:ring-2 focus:ring-senate-navy focus:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-50',
            isOutOfRange
              ? 'border-red-300 bg-red-50 text-red-700'
              : 'border-input bg-background text-foreground',
          )}
        />

        {showAdjectival && (
          <span
            id={`${id}-adjectival`}
            className={cn(
              'inline-flex items-center rounded px-2 py-1 text-xs font-medium transition-colors',
              adjectival
                ? ADJECTIVAL_COLOR[adjectival]
                : 'text-muted-foreground bg-muted',
            )}
          >
            {adjectival
              ? RATING_BANDS[adjectival].label
              : isOutOfRange
              ? 'Out of range'
              : 'Enter rating'}
          </span>
        )}
      </div>

      {isOutOfRange && (
        <p className="text-xs text-red-600" role="alert">
          Rating must be between {MIN_RATING.toFixed(3)} and {MAX_RATING.toFixed(3)}.
        </p>
      )}
    </div>
  );
}
