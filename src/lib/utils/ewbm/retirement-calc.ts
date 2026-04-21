/**
 * EWBM — Retirement eligibility math (pure).
 *
 * Rules (Philippine Civil Service + PCSO HR):
 *   - Optional retirement: age >= 60 AND years_of_service >= 15
 *   - Compulsory retirement: age >= 65 (service length irrelevant)
 *
 * EWB-003 requires annual notices for anyone reaching either milestone
 * within the next 12 months.
 */

const MILLIS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365.25;

export type RetirementKind = "optional" | "compulsory" | "none";

export interface EligibilityProjection {
  readonly type: RetirementKind;
  readonly months: number;
  readonly eligibleDate: Date | null;
}

/**
 * Age in whole years at `asOf`. Uses calendar-month logic so a birthday on
 * the 1st of a month correctly bumps age for any asOf on/after that day.
 */
function ageAt(dob: Date, asOf: Date): number {
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
  const m = asOf.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && asOf.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/** Decimal years between `from` and `to`, clamped at 0. */
function decimalYears(from: Date, to: Date): number {
  const diff = to.getTime() - from.getTime();
  if (diff <= 0) return 0;
  return diff / MILLIS_PER_DAY / DAYS_PER_YEAR;
}

export function isOptionalRetirement(age: number, yos: number): boolean {
  return age >= 60 && yos >= 15;
}

export function isCompulsoryRetirement(age: number): boolean {
  return age >= 65;
}

/**
 * Whole months between two dates (floor). Returns 0 if `to <= from`.
 */
function monthsBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Computes the nearest retirement eligibility date for a given employee and
 * reports months until that date.
 *
 * Resolution:
 *   - Optional: max(date of 60th birthday, date at which yos reaches 15).
 *   - Compulsory: date of 65th birthday.
 *   - Whichever comes first is returned; ties prefer 'optional'.
 *   - If already eligible as of `asOf`, returns { months: 0 } with the
 *     earliest triggered type.
 */
export function monthsUntilEligible(
  dob: Date,
  hireDate: Date,
  asOf: Date,
): EligibilityProjection {
  // Optional: 60th birthday
  const optionalAgeDate = new Date(
    Date.UTC(dob.getUTCFullYear() + 60, dob.getUTCMonth(), dob.getUTCDate()),
  );
  // Optional: yos >= 15 (hireDate + 15y)
  const optionalYosDate = new Date(
    Date.UTC(
      hireDate.getUTCFullYear() + 15,
      hireDate.getUTCMonth(),
      hireDate.getUTCDate(),
    ),
  );
  const optionalEligible =
    optionalAgeDate.getTime() >= optionalYosDate.getTime()
      ? optionalAgeDate
      : optionalYosDate;

  // Compulsory: 65th birthday
  const compulsoryEligible = new Date(
    Date.UTC(dob.getUTCFullYear() + 65, dob.getUTCMonth(), dob.getUTCDate()),
  );

  // Already eligible?
  const currentAge = ageAt(dob, asOf);
  const currentYos = decimalYears(hireDate, asOf);
  if (isCompulsoryRetirement(currentAge)) {
    return { type: "compulsory", months: 0, eligibleDate: compulsoryEligible };
  }
  if (isOptionalRetirement(currentAge, currentYos)) {
    return { type: "optional", months: 0, eligibleDate: optionalEligible };
  }

  // Both milestones are ahead — pick the sooner.
  const optMonths = monthsBetween(asOf, optionalEligible);
  const compMonths = monthsBetween(asOf, compulsoryEligible);

  if (optionalEligible.getTime() <= compulsoryEligible.getTime()) {
    return {
      type: "optional",
      months: optMonths,
      eligibleDate: optionalEligible,
    };
  }
  return {
    type: "compulsory",
    months: compMonths,
    eligibleDate: compulsoryEligible,
  };
}
