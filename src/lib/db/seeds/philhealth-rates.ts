/**
 * PhilHealth Premium Contribution Schedule
 * Source: PhilHealth Circular No. 2023-0014 (2024–2025 premium rates)
 *         RA 11223 — Universal Health Care Act (UHC)
 *
 * 2025 rate: 5% of Basic Monthly Salary, split equally 2.5% / 2.5%
 *   - Employee share: 2.5%
 *   - Employer share: 2.5%
 *   - Floor (min MSB): PHP 10,000  → minimum monthly premium = PHP 500.00
 *   - Ceiling (max MSB): PHP 100,000 → maximum monthly premium = PHP 5,000.00
 *
 * Semi-monthly payroll: deduct half of monthly premium each cut-off.
 */

export interface PhilhealthRateSeed {
  employeeRate: string;
  employerRate: string;
  minMsalary: string;
  maxMsalary: string;
  minPremium: string;
  maxPremium: string;
  effectiveDate: string;
}

export function buildPhilhealthRateSeeds(): PhilhealthRateSeed[] {
  return [
    {
      effectiveDate: '2025-01-01',
      employeeRate: '0.0250',      // 2.5%
      employerRate: '0.0250',      // 2.5%
      minMsalary: '10000.00',      // PHP 10,000
      maxMsalary: '100000.00',     // PHP 100,000
      minPremium: '500.00',        // PHP 500 / month
      maxPremium: '5000.00',       // PHP 5,000 / month
    },
  ];
}
