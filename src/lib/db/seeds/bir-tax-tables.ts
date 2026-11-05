/**
 * BIR Withholding Tax Tables — TRAIN Law (RA 10963)
 * Effective: January 1, 2023 onwards (second tranche of TRAIN)
 * Source: BIR RR 11-2018 Annex "Revised Withholding Tax Table" (2023 onwards).
 *
 * Monthly:
 *   ≤ 20,833                0
 *   20,833 – 33,332         15% of excess over 20,833
 *   33,333 – 66,666         1,875.00 + 20% of excess over 33,333
 *   66,667 – 166,666        8,541.80 + 25% of excess over 66,667
 *   166,667 – 666,666       33,541.80 + 30% of excess over 166,667
 *   ≥ 666,667               183,541.80 + 35% of excess over 666,667
 *
 * Semi-monthly:
 *   ≤ 10,417                0
 *   10,417 – 16,666         15% of excess over 10,417
 *   16,667 – 33,332         937.50 + 20% of excess over 16,667
 *   33,333 – 83,332         4,270.70 + 25% of excess over 33,333
 *   83,333 – 333,332        16,770.70 + 30% of excess over 83,333
 *   ≥ 333,333               91,770.70 + 35% of excess over 333,333
 *
 * bracketFrom is the "excess over" amount the payroll engine uses; bracketTo
 * is the next bracket's floor (null = open-ended top bracket).
 */

export interface BirTaxTableSeed {
  periodType: "semi_monthly" | "monthly";
  bracketFrom: string;
  bracketTo: string | null;
  baseTax: string;
  excessRate: string;
  effectiveDate: string;
}

const EFFECTIVE_DATE = "2023-01-01";

const monthlyBrackets: Omit<BirTaxTableSeed, "periodType" | "effectiveDate">[] =
  [
    {
      bracketFrom: "0.00",
      bracketTo: "20833.00",
      baseTax: "0.00",
      excessRate: "0.0000",
    },
    {
      bracketFrom: "20833.00",
      bracketTo: "33333.00",
      baseTax: "0.00",
      excessRate: "0.1500",
    },
    {
      bracketFrom: "33333.00",
      bracketTo: "66667.00",
      baseTax: "1875.00",
      excessRate: "0.2000",
    },
    {
      bracketFrom: "66667.00",
      bracketTo: "166667.00",
      baseTax: "8541.80",
      excessRate: "0.2500",
    },
    {
      bracketFrom: "166667.00",
      bracketTo: "666667.00",
      baseTax: "33541.80",
      excessRate: "0.3000",
    },
    {
      bracketFrom: "666667.00",
      bracketTo: null,
      baseTax: "183541.80",
      excessRate: "0.3500",
    },
  ];

const semiMonthlyBrackets: Omit<
  BirTaxTableSeed,
  "periodType" | "effectiveDate"
>[] = [
  {
    bracketFrom: "0.00",
    bracketTo: "10417.00",
    baseTax: "0.00",
    excessRate: "0.0000",
  },
  {
    bracketFrom: "10417.00",
    bracketTo: "16667.00",
    baseTax: "0.00",
    excessRate: "0.1500",
  },
  {
    bracketFrom: "16667.00",
    bracketTo: "33333.00",
    baseTax: "937.50",
    excessRate: "0.2000",
  },
  {
    bracketFrom: "33333.00",
    bracketTo: "83333.00",
    baseTax: "4270.70",
    excessRate: "0.2500",
  },
  {
    bracketFrom: "83333.00",
    bracketTo: "333333.00",
    baseTax: "16770.70",
    excessRate: "0.3000",
  },
  {
    bracketFrom: "333333.00",
    bracketTo: null,
    baseTax: "91770.70",
    excessRate: "0.3500",
  },
];

export function buildBirTaxTableSeeds(): BirTaxTableSeed[] {
  const monthly: BirTaxTableSeed[] = monthlyBrackets.map((b) => ({
    ...b,
    periodType: "monthly" as const,
    effectiveDate: EFFECTIVE_DATE,
  }));

  const semiMonthly: BirTaxTableSeed[] = semiMonthlyBrackets.map((b) => ({
    ...b,
    periodType: "semi_monthly" as const,
    effectiveDate: EFFECTIVE_DATE,
  }));

  return [...monthly, ...semiMonthly];
}
