/**
 * PBB Qualification Gates Validation Utility — PMM-007
 *
 * Per PRD Section 10.4.3:
 * Gate 1: IPCRF rating for current year >= Satisfactory (numerical >= 2.500)
 * Gate 2: No pending administrative case as of qualification date
 * Gate 3: No AWOL in rating period
 * Gate 4: SALN filed within prescribed period
 *
 * All 4 gates must pass for PBB eligibility.
 */

export interface PbbQualificationGates {
  gate1_rating: boolean;
  gate2_noAdminCase: boolean;
  gate3_noAwol: boolean;
  gate4_salnFiled: boolean;
}

export interface PbbQualificationResult {
  employeeId: string;
  employeeName: string;
  qualified: boolean;
  gates: PbbQualificationGates;
  /** Human-readable reason for disqualification if not qualified */
  disqualificationReason: string | null;
  /** Numerical IPCRF rating for reference */
  ipcrfRating: number | null;
}

/**
 * Minimum numerical rating for Satisfactory (CSC scale: 2.500-3.499)
 */
export const MIN_PBB_RATING = 2.5;

// ─── Rating-period date helpers (pure) ───────────────────────────────────────

const DAY_MS = 86_400_000;

function toUtcMs(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return Number.NaN;
  }
  return Date.UTC(year, month - 1, day);
}

function toIsoDate(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

/**
 * Calendar date range for a rating semester (PRD 14.6: 1 = Jan-Jun, 2 = Jul-Dec).
 */
export function semesterDateRange(
  year: number,
  semester: number,
): { from: string; to: string } {
  if (semester === 1) {
    return { from: `${year}-01-01`, to: `${year}-06-30` };
  }
  if (semester === 2) {
    return { from: `${year}-07-01`, to: `${year}-12-31` };
  }
  throw new Error(`Invalid semester: ${semester} (expected 1 or 2)`);
}

/**
 * Enumerates working days (ISO YYYY-MM-DD) in an inclusive date range,
 * excluding weekends and the supplied non-working holiday dates.
 *
 * Returns an empty array for invalid or inverted ranges.
 */
export function enumerateWorkingDays(
  dateFrom: string,
  dateTo: string,
  nonWorkingHolidayDates: Iterable<string>,
): string[] {
  const startMs = toUtcMs(dateFrom);
  const endMs = toUtcMs(dateTo);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    return [];
  }

  const holidaySet = new Set(nonWorkingHolidayDates);
  const workingDays: string[] = [];
  for (let ms = startMs; ms <= endMs; ms += DAY_MS) {
    const dayOfWeek = new Date(ms).getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // weekend
    const isoDate = toIsoDate(ms);
    if (holidaySet.has(isoDate)) continue;
    workingDays.push(isoDate);
  }
  return workingDays;
}

/** Inclusive ISO date interval (e.g., an approved leave span) */
export interface DateInterval {
  from: string;
  to: string;
}

/**
 * AWOL detection (Gate 3, PRD 10.4.3): a working day is AWOL when the employee
 * has no attendance log for that day AND no approved leave covering it.
 *
 * ISO date strings compare correctly lexicographically, so interval checks
 * (and the hire-date clamp) use plain string comparison.
 *
 * `activeFromDate` clamps the AWOL window: days before it (e.g. before the
 * employee's hire date) are never counted as AWOL — the person did not yet
 * exist in the workforce.
 *
 * `exemptDates` suppresses AWOL flagging for specific working days even with no
 * log (e.g. half-day work suspensions, where a no-capture day is not AWOL).
 *
 * @returns The list of AWOL working days (empty = no AWOL).
 */
export function findAwolDays(params: {
  workingDays: readonly string[];
  attendanceDates: ReadonlySet<string>;
  approvedLeaveIntervals: readonly DateInterval[];
  /** Inclusive lower bound (ISO YYYY-MM-DD); days before it are never AWOL. */
  activeFromDate?: string;
  /** Working days exempt from AWOL flagging even without a log. */
  exemptDates?: ReadonlySet<string>;
}): string[] {
  const {
    workingDays,
    attendanceDates,
    approvedLeaveIntervals,
    activeFromDate,
    exemptDates,
  } = params;
  return workingDays.filter((day) => {
    if (activeFromDate !== undefined && day < activeFromDate) return false;
    if (exemptDates?.has(day)) return false;
    if (attendanceDates.has(day)) return false;
    return !approvedLeaveIntervals.some(
      (interval) => interval.from <= day && day <= interval.to,
    );
  });
}

/**
 * Validates PBB qualification gates for a single employee.
 *
 * @param params - Employee qualification data
 * @returns PbbQualificationResult with gate-by-gate breakdown
 */
export function validatePbbQualification(params: {
  employeeId: string;
  employeeName: string;
  /** Numerical IPCRF rating (1.000-5.000) or null if not rated */
  ipcrfRating: number | null;
  /** True if employee has pending administrative case */
  hasPendingAdminCase: boolean;
  /** True if employee had AWOL in rating period */
  hadAwol: boolean;
  /** True if SALN was filed within prescribed period */
  salnFiled: boolean;
}): PbbQualificationResult {
  const gates: PbbQualificationGates = {
    gate1_rating:
      params.ipcrfRating !== null && params.ipcrfRating >= MIN_PBB_RATING,
    gate2_noAdminCase: !params.hasPendingAdminCase,
    gate3_noAwol: !params.hadAwol,
    gate4_salnFiled: params.salnFiled,
  };

  const qualified = Object.values(gates).every((g) => g === true);

  let disqualificationReason: string | null = null;
  if (!qualified) {
    const failedGates: string[] = [];
    if (!gates.gate1_rating) {
      failedGates.push(
        `Rating below Satisfactory (${params.ipcrfRating?.toFixed(3) ?? "N/A"} < ${MIN_PBB_RATING})`,
      );
    }
    if (!gates.gate2_noAdminCase) {
      failedGates.push("Pending administrative case");
    }
    if (!gates.gate3_noAwol) {
      failedGates.push("AWOL in rating period");
    }
    if (!gates.gate4_salnFiled) {
      failedGates.push("SALN not filed");
    }
    disqualificationReason = failedGates.join("; ");
  }

  return {
    employeeId: params.employeeId,
    employeeName: params.employeeName,
    qualified,
    gates,
    disqualificationReason,
    ipcrfRating: params.ipcrfRating,
  };
}

/**
 * Batch validates PBB qualification for multiple employees.
 *
 * @param employees - Array of employee qualification data
 * @returns Object with qualified and disqualified lists
 */
export function batchValidatePbbQualification(
  employees: Array<{
    employeeId: string;
    employeeName: string;
    ipcrfRating: number | null;
    hasPendingAdminCase: boolean;
    hadAwol: boolean;
    salnFiled: boolean;
  }>,
): {
  qualified: PbbQualificationResult[];
  disqualified: PbbQualificationResult[];
  summary: {
    total: number;
    qualifiedCount: number;
    disqualifiedCount: number;
    gate1Failures: number;
    gate2Failures: number;
    gate3Failures: number;
    gate4Failures: number;
  };
} {
  const results = employees.map((emp) => validatePbbQualification(emp));

  const qualified = results.filter((r) => r.qualified);
  const disqualified = results.filter((r) => !r.qualified);

  // Count gate failures for summary
  const gate1Failures = disqualified.filter(
    (r) => !r.gates.gate1_rating,
  ).length;
  const gate2Failures = disqualified.filter(
    (r) => !r.gates.gate2_noAdminCase,
  ).length;
  const gate3Failures = disqualified.filter(
    (r) => !r.gates.gate3_noAwol,
  ).length;
  const gate4Failures = disqualified.filter(
    (r) => !r.gates.gate4_salnFiled,
  ).length;

  return {
    qualified,
    disqualified,
    summary: {
      total: employees.length,
      qualifiedCount: qualified.length,
      disqualifiedCount: disqualified.length,
      gate1Failures,
      gate2Failures,
      gate3Failures,
      gate4Failures,
    },
  };
}
