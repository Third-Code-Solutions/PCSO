/**
 * GSIS Contribution Rates
 * Source: RA 8291 (GSIS Act of 1997), as amended
 *
 * Current rates (unchanged since RA 8291):
 *   Employee personal share:   9%  of Basic Monthly Salary
 *   Government employer share: 12% of Basic Monthly Salary
 *   Life Insurance premium:    0.5% of Basic Monthly Salary (included in employee share)
 *
 * Note: The 9% employee share already includes the 0.5% life insurance premium.
 * Separate life insurance rate stored for payslip line-item breakdown.
 */

export interface GsisRateSeed {
  employeeRate: string;
  employerRate: string;
  lifeInsuranceRate: string;
  effectiveDate: string;
}

export function buildGsisRateSeeds(): GsisRateSeed[] {
  return [
    {
      employeeRate: '0.0900',    // 9%
      employerRate: '0.1200',    // 12%
      lifeInsuranceRate: '0.0050', // 0.5% (sub-component of employee share)
      effectiveDate: '1997-06-24', // RA 8291 original effectivity
    },
  ];
}
