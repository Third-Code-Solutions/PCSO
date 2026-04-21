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
