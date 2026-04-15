/**
 * SALN net worth computation utilities — Senate HRIS Phase 13
 *
 * Aggregates assets from all categories and subtracts total liabilities.
 * Money values are string-represented numeric(14,2) values per conventions.
 *
 * All arithmetic uses string-to-BigInt-scaled integers to avoid floating-point
 * rounding errors on government financial data.
 */

import type {
  RealAsset,
  PersonalProperty,
  Investment,
  Liability,
} from '@/lib/validations/saln';

// ---------------------------------------------------------------------------
// Internal: fixed-point integer arithmetic (2 decimal places → multiply × 100)
// ---------------------------------------------------------------------------

function parseCents(value: string): bigint {
  const [intPart = '0', fracPart = '00'] = value.split('.');
  const padded = fracPart.padEnd(2, '0').slice(0, 2);
  return BigInt(intPart) * 100n + BigInt(padded);
}

function centsToString(cents: bigint): string {
  const abs = cents < 0n ? -cents : cents;
  const sign = cents < 0n ? '-' : '';
  const intPart = abs / 100n;
  const fracPart = (abs % 100n).toString().padStart(2, '0');
  return `${sign}${intPart}.${fracPart}`;
}

function sumStrings(values: string[]): bigint {
  return values.reduce((acc, v) => acc + parseCents(v), 0n);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Total value of all real properties (uses marketValue per CSC format). */
export function totalRealAssets(items: RealAsset[]): string {
  return centsToString(sumStrings(items.map((i) => i.marketValue)));
}

/** Total acquisition cost of all personal properties. */
export function totalPersonalProperties(items: PersonalProperty[]): string {
  return centsToString(sumStrings(items.map((i) => i.currentFairMarketValue)));
}

/** Total amount of all investments / financial assets. */
export function totalInvestments(items: Investment[]): string {
  return centsToString(sumStrings(items.map((i) => i.amount)));
}

/** Grand total of all assets (real + personal + investments). */
export function totalAssets(
  realAssets: RealAsset[],
  personalProperties: PersonalProperty[],
  investments: Investment[],
): string {
  const real = parseCents(totalRealAssets(realAssets));
  const personal = parseCents(totalPersonalProperties(personalProperties));
  const invest = parseCents(totalInvestments(investments));
  return centsToString(real + personal + invest);
}

/** Grand total of all outstanding liabilities. */
export function totalLiabilities(items: Liability[]): string {
  return centsToString(sumStrings(items.map((i) => i.outstandingBalance)));
}

/** Net worth = total assets − total liabilities. */
export function computeNetWorth(
  realAssets: RealAsset[],
  personalProperties: PersonalProperty[],
  investments: Investment[],
  liabilities: Liability[],
): {
  totalRealAssets: string;
  totalPersonalProperties: string;
  totalInvestments: string;
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
} {
  const realTotal = totalRealAssets(realAssets);
  const personalTotal = totalPersonalProperties(personalProperties);
  const investTotal = totalInvestments(investments);

  const assetsTotal = centsToString(
    parseCents(realTotal) + parseCents(personalTotal) + parseCents(investTotal),
  );
  const liabilitiesTotal = totalLiabilities(liabilities);
  const netWorthValue = centsToString(
    parseCents(assetsTotal) - parseCents(liabilitiesTotal),
  );

  return {
    totalRealAssets: realTotal,
    totalPersonalProperties: personalTotal,
    totalInvestments: investTotal,
    totalAssets: assetsTotal,
    totalLiabilities: liabilitiesTotal,
    netWorth: netWorthValue,
  };
}

/** Format a money string for display (Philippine peso). */
export function formatPeso(value: string): string {
  const num = parseFloat(value);
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(num);
}
