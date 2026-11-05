/**
 * Chargeable leave-day computation (H-09, CSC Omnibus Rules on Leave §10.1.2).
 *
 * Pure: the caller supplies the holiday / work-suspension calendar so this
 * stays testable and the server never trusts a client-computed day count.
 *
 * Rules:
 *  - Saturdays and Sundays are not charged (standard Mon–Fri schedule).
 *  - Regular and special non-working holidays are not charged.
 *  - A full-day work suspension is not charged; a half-day suspension leaves
 *    at most 0.5 chargeable for that date.
 *  - Half-day (AM/PM) leave charges 0.5 per working day.
 */

export type SuspensionSpan = "full" | "half";
export type LeavePeriod = "am" | "pm" | "whole_day";

export interface NonWorkingCalendar {
  /** ISO dates (YYYY-MM-DD) of non-working holidays. */
  holidays?: ReadonlySet<string>;
  /** ISO date → suspended span. */
  suspensions?: ReadonlyMap<string, SuspensionSpan>;
}

const DAY_MS = 86_400_000;

export function countChargeableDays(
  startDate: string,
  endDate: string,
  calendar: NonWorkingCalendar & { period?: LeavePeriod } = {},
): number {
  const dayCharge =
    calendar.period === "am" || calendar.period === "pm" ? 0.5 : 1;
  const end = Date.parse(`${endDate}T00:00:00Z`);
  let total = 0;
  for (let t = Date.parse(`${startDate}T00:00:00Z`); t <= end; t += DAY_MS) {
    const day = new Date(t);
    const dow = day.getUTCDay();
    const iso = day.toISOString().slice(0, 10);
    if (dow === 0 || dow === 6 || calendar.holidays?.has(iso)) continue;
    const suspended = calendar.suspensions?.get(iso);
    const open = suspended === "full" ? 0 : suspended === "half" ? 0.5 : 1;
    total += Math.min(dayCharge, open);
  }
  return total;
}
