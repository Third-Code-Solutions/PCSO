/**
 * PDS Section 31 (CS Form 212 page 4) — Special Skills & Hobbies.
 *
 * Pure normalization used by the EPM-012 PDS-update approval write path
 * before the value is committed to `employees.special_skills_hobbies`
 * (the store the EWBM wellness report reads). Trims entries, drops blanks,
 * and de-duplicates case-insensitively while preserving first-seen order.
 *
 * All functions here are total: malformed input degrades to empty arrays
 * and never throws, so a single bad payload can never break the approval.
 */

export interface PdsSection31 {
  skills: string[];
  hobbies: string[];
}

function normalizeList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Normalize an arbitrary Section-31 payload into the committed shape.
 * Accepts `{ skills, hobbies }` in any casing of validity; anything that is
 * not a string array degrades to `[]`.
 */
export function normalizePdsSection31(raw: unknown): PdsSection31 {
  if (!raw || typeof raw !== "object") return { skills: [], hobbies: [] };
  const obj = raw as Record<string, unknown>;
  return {
    skills: normalizeList(obj["skills"]),
    hobbies: normalizeList(obj["hobbies"]),
  };
}

/**
 * True when the normalized payload carries at least one skill or hobby.
 * Used to decide whether a wellness-propagation write is meaningful.
 */
export function hasSection31Content(section: PdsSection31): boolean {
  return section.skills.length > 0 || section.hobbies.length > 0;
}
