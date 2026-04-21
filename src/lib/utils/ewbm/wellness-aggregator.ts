/**
 * EWBM — Wellness aggregation (pure).
 *
 * Feeds EWB-005. Given PDS Section 31 (Special Skills & Hobbies) records
 * from a set of employees, produce two frequency maps: skill→count,
 * hobby→count. Counts are de-duplicated WITHIN one employee's record so
 * "PhotoShop, photoshop" from a single respondent counts once, not twice.
 */

export interface PdsSection31Record {
  readonly employeeId: string;
  readonly officeId: string | null;
  readonly skills: readonly string[];
  readonly hobbies: readonly string[];
}

export interface WellnessAggregate {
  readonly skillsAggregate: Record<string, number>;
  readonly hobbiesAggregate: Record<string, number>;
  readonly totalEmployees: number;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

/**
 * Case-insensitive bucket key generator that preserves a reasonable display
 * casing: the first occurrence (after trim) is what we label the bucket.
 */
function bumpBucket(
  bucket: Record<string, number>,
  displayBucket: Record<string, string>,
  raw: string,
): void {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return;
  const key = normalize(trimmed);
  if (!displayBucket[key]) {
    displayBucket[key] = trimmed;
  }
  bucket[key] = (bucket[key] ?? 0) + 1;
}

function toDisplayMap(
  counts: Record<string, number>,
  displayBucket: Record<string, string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(counts)) {
    const label = displayBucket[key] ?? key;
    const count = counts[key] ?? 0;
    out[label] = count;
  }
  return out;
}

export function aggregateSkillsAndHobbies(
  records: readonly PdsSection31Record[],
): WellnessAggregate {
  const skillCounts: Record<string, number> = {};
  const skillDisplay: Record<string, string> = {};
  const hobbyCounts: Record<string, number> = {};
  const hobbyDisplay: Record<string, string> = {};

  for (const rec of records) {
    // De-dupe within one employee's record so repeats don't inflate counts.
    const skillsForEmployee = new Set<string>();
    for (const s of rec.skills) {
      const key = normalize(s);
      if (key.length === 0) continue;
      if (!skillsForEmployee.has(key)) {
        skillsForEmployee.add(key);
        bumpBucket(skillCounts, skillDisplay, s);
      }
    }

    const hobbiesForEmployee = new Set<string>();
    for (const h of rec.hobbies) {
      const key = normalize(h);
      if (key.length === 0) continue;
      if (!hobbiesForEmployee.has(key)) {
        hobbiesForEmployee.add(key);
        bumpBucket(hobbyCounts, hobbyDisplay, h);
      }
    }
  }

  return {
    skillsAggregate: toDisplayMap(skillCounts, skillDisplay),
    hobbiesAggregate: toDisplayMap(hobbyCounts, hobbyDisplay),
    totalEmployees: records.length,
  };
}
