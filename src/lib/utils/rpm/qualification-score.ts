/**
 * Smart Pre-Screening — 4-dimension deterministic match score.
 *
 * Per CLAUDE.md §6.5, total score is a weighted sum of four dimensions
 * (education, eligibility, experience, training) with a documented default
 * of 25/25/25/25. PURE and DETERMINISTIC: no I/O, no randomness, same input
 * always produces the same output.
 *
 * Scale: 0–100.
 *
 * The inputs are intentionally loose — applicants submit JSONB payloads so
 * we normalise at the function boundary rather than forcing callers to
 * massage shapes upstream.
 */

export const EDUCATION_LEVEL_ORDER = [
  "elementary",
  "secondary",
  "vocational",
  "college",
  "graduate",
  "post_graduate",
] as const;

export type EducationLevel = (typeof EDUCATION_LEVEL_ORDER)[number];

export interface ApplicantTraining {
  title?: string;
  hours?: number;
}

export interface ApplicantEducationDegree {
  level?: string;
}

export interface ApplicantWorkExperience {
  startDate?: string;
  endDate?: string | null;
  isCurrent?: boolean;
}

export interface ApplicantEligibilityEntry {
  type?: string;
}

/**
 * Normalised applicant profile used by the scorer. Callers can pass the raw
 * JSONB payload as `unknown`; {@link computeMatchScore} does its own defensive
 * parsing.
 */
export interface ApplicantProfile {
  educationalBackground?: readonly ApplicantEducationDegree[];
  eligibility?: readonly ApplicantEligibilityEntry[];
  workExperience?: readonly ApplicantWorkExperience[];
  trainings?: readonly ApplicantTraining[];
}

export interface VacancyQualificationStandards {
  /** Free-text description of minimum education (e.g. "Bachelor's in IT"). */
  education?: string;
  /** Required eligibility text (e.g. "Career Service Professional"). */
  eligibility?: string;
  /** Minimum years of relevant experience. */
  experience?: number;
  /** Free-text description of required training. */
  training?: string;
  weights?: {
    education?: number;
    eligibility?: number;
    experience?: number;
    training?: number;
  };
}

export interface MatchScoreBreakdown {
  /** 0–100 */
  educationPct: number;
  eligibilityMatch: boolean;
  experienceYears: number;
  requiredYears: number;
  /** 0–100 */
  trainingPct: number;
}

export interface MatchScoreResult {
  total: number; // 0..100
  breakdown: MatchScoreBreakdown;
}

const DEFAULT_WEIGHTS = {
  education: 25,
  eligibility: 25,
  experience: 25,
  training: 25,
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function normaliseEducationLevel(
  raw: string | undefined,
): EducationLevel | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if ((EDUCATION_LEVEL_ORDER as readonly string[]).includes(lower)) {
    return lower as EducationLevel;
  }
  // Common synonyms.
  if (lower.includes("doctor") || lower.includes("phd")) return "post_graduate";
  if (lower.includes("master") || lower.includes("graduate")) return "graduate";
  if (lower.includes("bachelor") || lower.includes("college")) return "college";
  if (lower.includes("high school") || lower.includes("secondary"))
    return "secondary";
  if (lower.includes("vocat")) return "vocational";
  if (lower.includes("element")) return "elementary";
  return null;
}

function educationRank(level: EducationLevel | null | undefined): number {
  if (!level) return -1;
  return EDUCATION_LEVEL_ORDER.indexOf(level);
}

/**
 * Infer the highest attainment level from the applicant's education history.
 */
function highestEducation(
  degrees: readonly ApplicantEducationDegree[] | undefined,
): EducationLevel | null {
  if (!degrees || degrees.length === 0) return null;
  let best: EducationLevel | null = null;
  let bestRank = -1;
  for (const d of degrees) {
    const lvl = normaliseEducationLevel(d.level);
    const rank = educationRank(lvl);
    if (rank > bestRank) {
      best = lvl;
      bestRank = rank;
    }
  }
  return best;
}

/** Fractional education match (0..1). */
function educationFraction(
  applicant: EducationLevel | null,
  requiredText: string | undefined,
): number {
  const required = normaliseEducationLevel(requiredText);
  const reqRank = educationRank(required);
  if (reqRank <= 0) return applicant ? 1 : 0;
  const appRank = educationRank(applicant);
  if (appRank < 0) return 0;
  return Math.min(1, (appRank + 1) / (reqRank + 1));
}

function eligibilityMatches(
  applicantEntries: readonly ApplicantEligibilityEntry[] | undefined,
  requiredText: string | undefined,
): boolean {
  if (!requiredText || requiredText.trim().length === 0) return true;
  if (!applicantEntries || applicantEntries.length === 0) return false;
  const requiredLower = requiredText.toLowerCase();
  return applicantEntries.some((e) => {
    if (!e.type) return false;
    const type = e.type.toLowerCase();
    return requiredLower.includes(type) || type.includes(requiredLower);
  });
}

function totalExperienceYears(
  entries: readonly ApplicantWorkExperience[] | undefined,
): number {
  if (!entries || entries.length === 0) return 0;
  let totalMs = 0;
  const now = Date.now();
  for (const e of entries) {
    if (!e.startDate) continue;
    const start = Date.parse(e.startDate);
    if (Number.isNaN(start)) continue;
    const endRaw = e.isCurrent ? null : (e.endDate ?? null);
    const end = endRaw ? Date.parse(endRaw) : now;
    if (Number.isNaN(end) || end <= start) continue;
    totalMs += end - start;
  }
  return totalMs / (1000 * 60 * 60 * 24 * 365.25);
}

function experienceFraction(
  applicantYears: number,
  requiredYears: number | undefined,
): number {
  const req = requiredYears ?? 0;
  if (req <= 0) return 1;
  return Math.min(1, applicantYears / req);
}

function trainingFraction(
  applicantTrainings: readonly ApplicantTraining[] | undefined,
  requiredText: string | undefined,
): number {
  if (!requiredText || requiredText.trim().length === 0) return 1;
  if (!applicantTrainings || applicantTrainings.length === 0) return 0;
  // Tokenise required text (comma / semicolon / newline separated).
  const required = requiredText
    .split(/[,;\n]/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  if (required.length === 0) return 1;
  const appTitles = applicantTrainings
    .map((t) => (t.title ? t.title.toLowerCase().trim() : ""))
    .filter((t) => t.length > 0);
  if (appTitles.length === 0) return 0;
  const hits = required.filter((r) =>
    appTitles.some((a) => a.includes(r) || r.includes(a)),
  ).length;
  return hits / required.length;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute a 0–100 match score and dimensional breakdown for an applicant
 * against a vacancy's qualification standards. Deterministic and pure.
 */
export function computeMatchScore(
  profile: ApplicantProfile,
  standards: VacancyQualificationStandards,
): MatchScoreResult {
  const weights = {
    education: standards.weights?.education ?? DEFAULT_WEIGHTS.education,
    eligibility: standards.weights?.eligibility ?? DEFAULT_WEIGHTS.eligibility,
    experience: standards.weights?.experience ?? DEFAULT_WEIGHTS.experience,
    training: standards.weights?.training ?? DEFAULT_WEIGHTS.training,
  };

  const highest = highestEducation(profile.educationalBackground);
  const eduFrac = educationFraction(highest, standards.education);
  const eligMatch = eligibilityMatches(
    profile.eligibility,
    standards.eligibility,
  );
  const expYears = totalExperienceYears(profile.workExperience);
  const expFrac = experienceFraction(expYears, standards.experience);
  const trainFrac = trainingFraction(profile.trainings, standards.training);

  const totalWeight =
    weights.education +
    weights.eligibility +
    weights.experience +
    weights.training;

  const rawTotal =
    eduFrac * weights.education +
    (eligMatch ? 1 : 0) * weights.eligibility +
    expFrac * weights.experience +
    trainFrac * weights.training;

  const total =
    totalWeight > 0 ? Math.round((rawTotal / totalWeight) * 100) : 0;

  return {
    total,
    breakdown: {
      educationPct: Number((eduFrac * 100).toFixed(2)),
      eligibilityMatch: eligMatch,
      experienceYears: Number(expYears.toFixed(2)),
      requiredYears: standards.experience ?? 0,
      trainingPct: Number((trainFrac * 100).toFixed(2)),
    },
  };
}
