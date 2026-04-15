/**
 * RatingBadge — color-coded adjectival rating display.
 *
 * Color coding:
 *   Outstanding      → emerald
 *   Very Satisfactory → blue
 *   Satisfactory     → amber
 *   Unsatisfactory   → orange
 *   Poor             → red
 */

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { RATING_BANDS } from '@/lib/constants/performance';
import type { AdjectivalRating } from '@/lib/constants/performance';

interface RatingBadgeProps {
  adjectival: AdjectivalRating;
  numerical?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const COLOR_CLASS: Record<AdjectivalRating, string> = {
  outstanding:
    'bg-emerald-100 text-emerald-800 border-emerald-200',
  very_satisfactory:
    'bg-blue-100 text-blue-800 border-blue-200',
  satisfactory:
    'bg-amber-100 text-amber-800 border-amber-200',
  unsatisfactory:
    'bg-orange-100 text-orange-800 border-orange-200',
  poor:
    'bg-red-100 text-red-800 border-red-200',
};

const DOT_CLASS: Record<AdjectivalRating, string> = {
  outstanding: 'bg-emerald-500',
  very_satisfactory: 'bg-blue-500',
  satisfactory: 'bg-amber-500',
  unsatisfactory: 'bg-orange-500',
  poor: 'bg-red-500',
};

const SIZE_CLASS = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1.5',
};

export function RatingBadge({
  adjectival,
  numerical,
  size = 'md',
  className,
}: RatingBadgeProps) {
  const band = RATING_BANDS[adjectival];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        COLOR_CLASS[adjectival],
        SIZE_CLASS[size],
        className,
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', DOT_CLASS[adjectival])}
        aria-hidden
      />
      {numerical !== undefined && (
        <span className="font-tabular-nums">{numerical.toFixed(3)}</span>
      )}
      <span>{band.label}</span>
    </span>
  );
}

/**
 * Compact rating display showing just the numerical value color-coded by band.
 */
interface NumericalRatingDisplayProps {
  numerical: number;
  adjectival: AdjectivalRating;
  className?: string;
}

export function NumericalRatingDisplay({
  numerical,
  adjectival,
  className,
}: NumericalRatingDisplayProps) {
  const textColor: Record<AdjectivalRating, string> = {
    outstanding: 'text-emerald-700',
    very_satisfactory: 'text-blue-700',
    satisfactory: 'text-amber-700',
    unsatisfactory: 'text-orange-700',
    poor: 'text-red-700',
  };

  return (
    <span className={cn('font-tabular-nums font-semibold', textColor[adjectival], className)}>
      {numerical.toFixed(3)}
    </span>
  );
}
