/**
 * Banker's rounding (half-even) for government compliance.
 * Per BSP circulars, GSIS, PhilHealth, and BIR all mandate half-even rounding.
 *
 * Half-even: when the value is exactly halfway between two representable values,
 * rounds to the nearest even digit. This is the default rounding mode in most
 * banking and accounting systems.
 *
 * Examples:
 *   2.5  → 2  (even)
 *   3.5  → 4  (even)
 *   4.5  → 4  (even)
 *   0.045 → 0.04 (even)
 *   0.055 → 0.06 (even)
 */
export function roundHalfEven(value: number, decimals: number = 2): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`roundHalfEven: value must be finite, got ${value}`);
  }

  // Scale to integer domain to avoid floating-point drift
  const factor = Math.pow(10, decimals);
  const scaled = value * factor;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;

  let rounded: number;

  if (Math.abs(diff - 0.5) < Number.EPSILON * 10) {
    // Exactly half — round to even
    rounded = floor % 2 === 0 ? floor : floor + 1;
  } else {
    rounded = Math.round(scaled);
  }

  return rounded / factor;
}

/**
 * Round a monetary value to 2 decimal places using half-even rounding,
 * returned as a formatted string with exactly 2 decimal places.
 */
export function roundMoney(value: number): string {
  const rounded = roundHalfEven(value, 2);
  return rounded.toFixed(2);
}

/**
 * Parse a money string to a number. Accepts strings like "1,234.56" or "1234.56".
 */
export function parseMoney(value: string): number {
  const cleaned = value.replace(/,/g, '');
  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed)) {
    throw new RangeError(`parseMoney: cannot parse "${value}" as a number`);
  }
  return parsed;
}

/**
 * Add two money amounts, round at end.
 * Use for accumulating small amounts where we want one final rounding.
 */
export function addMoney(a: number, b: number): number {
  return roundHalfEven(a + b, 2);
}

/**
 * Subtract two money amounts, round at end.
 */
export function subtractMoney(a: number, b: number): number {
  return roundHalfEven(a - b, 2);
}
