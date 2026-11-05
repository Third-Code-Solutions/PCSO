/**
 * Pag-IBIG (HDMF) Contribution Rates
 * Source: RA 9679 — Home Development Mutual Fund Law of 2009;
 *         HDMF Circular No. 460 (max Monthly Fund Salary raised to PHP 10,000,
 *         effective February 2024).
 *
 * Rate structure:
 *   Salary ≤ PHP 1,500:  Employee 1%, Employer 2%
 *   Salary > PHP 1,500:  Employee 2%, Employer 2%
 *
 * maxContribution is the monthly cap PER SIDE (employee and employer each):
 *   2009-06-17: 2% × PHP 5,000 MFS  = PHP 100
 *   2024-02-01: 2% × PHP 10,000 MFS = PHP 200
 * The payroll engine uses the row with the latest effectiveDate on or before
 * the period end.
 */

export interface PagibigRateSeed {
  employeeRateLow: string;
  employeeRateHigh: string;
  employerRate: string;
  salaryThreshold: string;
  maxContribution: string;
  effectiveDate: string;
}

export function buildPagibigRateSeeds(): PagibigRateSeed[] {
  return [
    {
      effectiveDate: "2009-06-17", // RA 9679 effectivity
      employeeRateLow: "0.0100", // 1% for salary ≤ threshold
      employeeRateHigh: "0.0200", // 2% for salary > threshold
      employerRate: "0.0200", // 2% (employer always 2%)
      salaryThreshold: "1500.00", // PHP 1,500 breakpoint
      maxContribution: "100.00", // PHP 100 per side (PHP 5,000 MFS)
    },
    {
      effectiveDate: "2024-02-01", // HDMF Circular 460: MFS PHP 10,000
      employeeRateLow: "0.0100",
      employeeRateHigh: "0.0200",
      employerRate: "0.0200",
      salaryThreshold: "1500.00",
      maxContribution: "200.00", // PHP 200 per side
    },
  ];
}
