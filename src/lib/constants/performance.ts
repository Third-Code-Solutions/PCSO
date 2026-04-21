/**
 * CSC Performance Management System constants — PCSO HRIS Phase 12
 *
 * Sources:
 * - CSC MC No. 6, s. 2012 (SPMS Guidelines)
 * - RA 9178 / DBM Step Increment Rules
 */

// ─── CSC Adjectival Rating Bands ────────────────────────────────────────────

export type AdjectivalRating =
  | "outstanding"
  | "very_satisfactory"
  | "satisfactory"
  | "unsatisfactory"
  | "poor";

export interface RatingBand {
  label: string;
  min: number;
  max: number;
  /** Tailwind color tokens for display */
  color: "emerald" | "blue" | "amber" | "orange" | "red";
}

export const RATING_BANDS: Record<AdjectivalRating, RatingBand> = {
  outstanding: {
    label: "Outstanding",
    min: 4.5,
    max: 5.0,
    color: "emerald",
  },
  very_satisfactory: {
    label: "Very Satisfactory",
    min: 3.5,
    max: 4.499,
    color: "blue",
  },
  satisfactory: {
    label: "Satisfactory",
    min: 2.5,
    max: 3.499,
    color: "amber",
  },
  unsatisfactory: {
    label: "Unsatisfactory",
    min: 1.5,
    max: 2.499,
    color: "orange",
  },
  poor: {
    label: "Poor",
    min: 1.0,
    max: 1.499,
    color: "red",
  },
} as const;

/** Ordered from highest to lowest for display purposes */
export const RATING_ORDER: AdjectivalRating[] = [
  "outstanding",
  "very_satisfactory",
  "satisfactory",
  "unsatisfactory",
  "poor",
];

// ─── Step Increment Rules ─────────────────────────────────────────────────────

/**
 * Number of consecutive periods at Very Satisfactory or better → step eligible.
 * CSC rule: 3 consecutive VS or better.
 */
export const STEP_INCREMENT_CONSECUTIVE_VS = 3;

/**
 * Number of consecutive periods at Outstanding → step eligible.
 * CSC rule: 2 consecutive Outstanding.
 */
export const STEP_INCREMENT_CONSECUTIVE_OUTSTANDING = 2;

/**
 * Minimum years between step increments (DBM rules).
 * An employee cannot receive more than one step increment within 3 years.
 */
export const STEP_INCREMENT_COOLDOWN_YEARS = 3;

// ─── IPCRF KRA / Rating Constants ────────────────────────────────────────────

/** Maximum KRAs allowed per IPCRF */
export const MAX_KRAS_PER_IPCRF = 10;

/** Total weight of all KRAs must sum to exactly this value */
export const TOTAL_KRA_WEIGHT = 100;

/** Minimum rating a rater may enter */
export const MIN_RATING = 1.0;

/** Maximum rating a rater may enter */
export const MAX_RATING = 5.0;

// ─── IPCRF Phase Labels ───────────────────────────────────────────────────────

export const IPCRF_PHASES = {
  planning: "Performance Planning",
  monitoring: "Performance Monitoring",
  review: "Performance Review",
} as const;

export type IpcrfPhase = keyof typeof IPCRF_PHASES;

// ─── Performance Period Status Labels ────────────────────────────────────────

export const PERIOD_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  rating: "Rating Phase",
  review: "Under Review",
  closed: "Closed",
};

// ─── Rating Status Labels ─────────────────────────────────────────────────────

export const RATING_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed",
  approved: "Approved",
  disapproved: "Disapproved",
};

// ─── Step Increment Status Labels ────────────────────────────────────────────

export const STEP_INCREMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  implemented: "Implemented",
  cancelled: "Cancelled",
};
