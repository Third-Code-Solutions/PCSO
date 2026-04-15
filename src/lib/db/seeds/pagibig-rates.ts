/**
 * Pag-IBIG (HDMF) Contribution Rates
 * Source: RA 9679 — Home Development Mutual Fund Law of 2009
 *         HDMF Circular No. 274 (revised contribution schedule)
 *
 * Rate structure:
 *   Salary ≤ PHP 1,500:  Employee 1%, Employer 2%
 *   Salary > PHP 1,500:  Employee 2%, Employer 2%
 *
 *   Maximum monthly contribution = PHP 200 per side (PHP 100 employee + PHP 100 employer)
 *   when salary exceeds PHP 5,000 (contributions are capped at PHP 5,000 base).
 *
 * In practice for government employees with SSL V salaries (all > 13,530),
 * the effective contribution is PHP 100 employee + PHP 100 employer = PHP 200/month.
 * The maximum combined = PHP 200; stored as maxContribution per side.
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
      effectiveDate: '2009-06-17', // RA 9679 effectivity
      employeeRateLow: '0.0100',   // 1% for salary ≤ threshold
      employeeRateHigh: '0.0200',  // 2% for salary > threshold
      employerRate: '0.0200',      // 2% (employer always 2%)
      salaryThreshold: '1500.00',  // PHP 1,500 breakpoint
      maxContribution: '100.00',   // PHP 100 cap per employee side (PHP 200 total)
    },
  ];
}
