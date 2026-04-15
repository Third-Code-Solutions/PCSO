/**
 * BIR Withholding Tax Tables — TRAIN Law (RA 10963)
 * Effective: January 1, 2023 onwards (second tranche of TRAIN)
 *
 * Monthly Taxable Income Brackets:
 * ┌──────────────────────────────┬─────────────────────────────────────────┐
 * │ Bracket                      │ Tax                                     │
 * ├──────────────────────────────┼─────────────────────────────────────────┤
 * │ 0 – 20,833                   │ 0%                                      │
 * │ 20,833.01 – 33,332           │ 15% of excess over 20,833               │
 * │ 33,332.01 – 66,666           │ 1,875 + 20% of excess over 33,332       │
 * │ 66,666.01 – 166,666          │ 8,541.80 + 25% of excess over 66,666    │
 * │ 166,666.01 – 666,666         │ 33,541.80 + 30% of excess over 166,666  │
 * │ 666,666.01 and above         │ 183,541.80 + 35% of excess over 666,666 │
 * └──────────────────────────────┴─────────────────────────────────────────┘
 *
 * Semi-monthly brackets = monthly brackets ÷ 2 (BIR Revenue Regulations 8-2018)
 * ┌──────────────────────────────┬─────────────────────────────────────────┐
 * │ Bracket                      │ Tax                                     │
 * ├──────────────────────────────┼─────────────────────────────────────────┤
 * │ 0 – 10,417                   │ 0%                                      │
 * │ 10,417.01 – 16,667           │ 15% of excess over 10,417               │
 * │ 16,667.01 – 33,333           │ 937.50 + 20% of excess over 16,667      │
 * │ 33,333.01 – 83,333           │ 4,270.83 + 25% of excess over 33,333    │
 * │ 83,333.01 – 333,333          │ 16,770.83 + 30% of excess over 83,333   │
 * │ 333,333.01 and above         │ 91,770.83 + 35% of excess over 333,333  │
 * └──────────────────────────────┴─────────────────────────────────────────┘
 *
 * Note: bracketTo = null means "no upper limit" (open-ended top bracket).
 */

export interface BirTaxTableSeed {
  periodType: 'semi_monthly' | 'monthly';
  bracketFrom: string;
  bracketTo: string | null;
  baseTax: string;
  excessRate: string;
  effectiveDate: string;
}

const EFFECTIVE_DATE = '2023-01-01';

const monthlyBrackets: Omit<BirTaxTableSeed, 'periodType' | 'effectiveDate'>[] = [
  {
    bracketFrom: '0.00',
    bracketTo: '20833.00',
    baseTax: '0.00',
    excessRate: '0.0000',
  },
  {
    bracketFrom: '20833.01',
    bracketTo: '33332.00',
    baseTax: '0.00',
    excessRate: '0.1500',
  },
  {
    bracketFrom: '33332.01',
    bracketTo: '66666.00',
    baseTax: '1875.00',
    excessRate: '0.2000',
  },
  {
    bracketFrom: '66666.01',
    bracketTo: '166666.00',
    baseTax: '8541.80',
    excessRate: '0.2500',
  },
  {
    bracketFrom: '166666.01',
    bracketTo: '666666.00',
    baseTax: '33541.80',
    excessRate: '0.3000',
  },
  {
    bracketFrom: '666666.01',
    bracketTo: null,
    baseTax: '183541.80',
    excessRate: '0.3500',
  },
];

const semiMonthlyBrackets: Omit<BirTaxTableSeed, 'periodType' | 'effectiveDate'>[] = [
  {
    bracketFrom: '0.00',
    bracketTo: '10417.00',
    baseTax: '0.00',
    excessRate: '0.0000',
  },
  {
    bracketFrom: '10417.01',
    bracketTo: '16667.00',
    baseTax: '0.00',
    excessRate: '0.1500',
  },
  {
    bracketFrom: '16667.01',
    bracketTo: '33333.00',
    baseTax: '937.50',
    excessRate: '0.2000',
  },
  {
    bracketFrom: '33333.01',
    bracketTo: '83333.00',
    baseTax: '4270.83',
    excessRate: '0.2500',
  },
  {
    bracketFrom: '83333.01',
    bracketTo: '333333.00',
    baseTax: '16770.83',
    excessRate: '0.3000',
  },
  {
    bracketFrom: '333333.01',
    bracketTo: null,
    baseTax: '91770.83',
    excessRate: '0.3500',
  },
];

export function buildBirTaxTableSeeds(): BirTaxTableSeed[] {
  const monthly: BirTaxTableSeed[] = monthlyBrackets.map((b) => ({
    ...b,
    periodType: 'monthly' as const,
    effectiveDate: EFFECTIVE_DATE,
  }));

  const semiMonthly: BirTaxTableSeed[] = semiMonthlyBrackets.map((b) => ({
    ...b,
    periodType: 'semi_monthly' as const,
    effectiveDate: EFFECTIVE_DATE,
  }));

  return [...monthly, ...semiMonthly];
}
