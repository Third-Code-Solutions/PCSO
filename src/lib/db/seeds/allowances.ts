/**
 * Standard Government Allowances
 * Sources:
 *   - RATA: EO 77 s. 1986, as amended by DBM-DOF Joint Circular No. 1 s. 2012
 *   - PERA: EO 611 s. 2007 (PHP 2,000/month flat for all rank-and-file)
 *   - Longevity Pay: Sec. 1, RA 6686 — PHP 100 × completed 5-year period
 *   - Representation Allowance: DBM NBM Policy and Procedures Manual
 *   - Transportation Allowance: same as above
 *
 * RATA (Representation and Transportation Allowance):
 *   Combined monthly RATA amounts by position/salary grade (SG-based).
 *   Only SG 24+ positions are typically entitled to RATA under EO 77.
 *   Amounts below are indicative; actual entitlement per DBM-approved plantilla.
 *
 * For longevity: computed dynamically (PHP 100 × 5-year periods served),
 *   stored as flatAmount = null; handled by payroll computation service.
 */

export interface AllowanceSeed {
  name: string;
  code: string;
  type:
    | "rata"
    | "representation"
    | "transportation"
    | "pera"
    | "hazard"
    | "subsistence"
    | "laundry"
    | "longevity";
  amountBySg: Record<string, string> | null;
  flatAmount: string | null;
  effectiveDate: string;
}

const EFFECTIVE_DATE = "2024-01-01";

export function buildAllowanceSeeds(): AllowanceSeed[] {
  return [
    // ─── PERA (Personnel Economic Relief Allowance) ───────────────────────────
    {
      name: "Personnel Economic Relief Allowance",
      code: "PERA",
      type: "pera",
      amountBySg: null,
      flatAmount: "2000.00", // PHP 2,000/month flat for all eligible employees
      effectiveDate: EFFECTIVE_DATE,
    },

    // ─── RATA (Representation and Transportation Allowance) ───────────────────
    // Combined R&T — typically position-specific; SG-based approximation below.
    // SGs not listed here are not entitled to RATA under EO 77.
    {
      name: "Representation and Transportation Allowance",
      code: "RATA",
      type: "rata",
      amountBySg: {
        "24": "11000.00",
        "25": "12000.00",
        "26": "13000.00",
        "27": "14000.00",
        "28": "15000.00",
        "29": "16000.00",
        "30": "18000.00",
        "31": "20000.00",
        "32": "22000.00",
        "33": "24000.00",
      },
      flatAmount: null,
      effectiveDate: EFFECTIVE_DATE,
    },

    // ─── Longevity Pay ────────────────────────────────────────────────────────
    // PHP 100 per completed 5-year continuous government service period.
    // Computed dynamically from date_hired; flatAmount = PHP 100 (one period unit).
    {
      name: "Longevity Pay",
      code: "LONGEVITY",
      type: "longevity",
      amountBySg: null,
      flatAmount: "100.00", // PHP 100 × number of completed 5-year periods
      effectiveDate: EFFECTIVE_DATE,
    },

    // ─── Hazard Pay ───────────────────────────────────────────────────────────
    // Under RA 7305 (Magna Carta of Public Health Workers) — not applicable
    // to PCSO staff generally, but included for completeness.
    {
      name: "Hazard Pay",
      code: "HAZARD",
      type: "hazard",
      amountBySg: {
        "1": "1000.00",
        "2": "1000.00",
        "3": "1000.00",
        "4": "1000.00",
        "5": "1000.00",
        "6": "1000.00",
        "7": "1000.00",
        "8": "1000.00",
        "9": "1000.00",
        "10": "1000.00",
        "11": "1000.00",
        "12": "1000.00",
        "13": "1000.00",
        "14": "1000.00",
        "15": "1000.00",
        "16": "1000.00",
        "17": "1000.00",
        "18": "1000.00",
        "19": "1000.00",
      },
      flatAmount: null,
      effectiveDate: EFFECTIVE_DATE,
    },
  ];
}
