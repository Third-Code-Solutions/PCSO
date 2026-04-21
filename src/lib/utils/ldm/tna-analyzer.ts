/**
 * TNA (Training Needs Analysis) gap-computation utilities.
 *
 * Pure functions — no database, no side effects. Consumed by
 * src/lib/actions/ldm/tna.ts which wires them to persistence.
 *
 * Design notes:
 *  - Baselines describe REQUIRED competency level per position tier
 *    (keyed by `salaryGradeMin`/`salaryGradeMax` or explicit tier code).
 *  - An assessment's "score" is normalized onto the same 1–5 level scale
 *    used by the baseline. Missing assessments count as level 0.
 *  - Gap = max(required - current, 0). Only rows with a positive gap
 *    are returned.
 */

// ─── Structural input types ──────────────────────────────────────────────────
//
// We define structural (shape-only) types here rather than importing
// `$inferSelect` types from the schema directly. This keeps the module
// independent of the schema file's exact column set and — critically —
// compilable while Agents 02/03 are still finalising their schemas.

export interface CompetencyAssessmentLike {
  id?: string;
  employeeId: string;
  domain: string;
  competencyCode: string;
  /** 1–5 level (integer). Optional — absence is treated as 0. */
  score: number | null;
  cycleYear: number;
}

export interface CompetencyBaselineLike {
  id?: string;
  domain: string;
  competencyCode: string;
  /** Required level, 1–5. */
  requiredLevel: number;
  /** Inclusive salary-grade bounds the baseline applies to. */
  salaryGradeMin: number;
  salaryGradeMax: number;
}

export interface TrainingProgramLike {
  id: string;
  title: string;
  description?: string | null;
  tags?: string[] | null;
}

export interface TnaGapLike {
  employeeId: string;
  domain: string;
  competencyCode: string;
  requiredLevel: number;
  currentLevel: number;
  gap: number;
  cycleYear: number;
}

export interface EmployeeContext {
  employeeId: string;
  salaryGrade: number;
  cycleYear: number;
}

export interface SuggestionRow {
  gap: TnaGapLike;
  suggestedProgramIds: string[];
}

// ─── computeGapsForEmployee ──────────────────────────────────────────────────

/**
 * For every baseline applicable to `employee.salaryGrade`, compare required
 * vs. current level and emit a gap row when `required > current`.
 *
 * `assessments` may contain rows for OTHER employees; they're filtered out.
 * The latest-by-cycleYear assessment wins when duplicates exist.
 */
export function computeGapsForEmployee(
  employee: EmployeeContext,
  assessments: readonly CompetencyAssessmentLike[],
  baselines: readonly CompetencyBaselineLike[],
): TnaGapLike[] {
  const ownAssessments = assessments.filter(
    (a) => a.employeeId === employee.employeeId,
  );

  // Latest assessment by (domain, competencyCode), keyed for O(1) lookup.
  const latestByKey = new Map<string, CompetencyAssessmentLike>();
  for (const a of ownAssessments) {
    const key = `${a.domain}::${a.competencyCode}`;
    const existing = latestByKey.get(key);
    if (!existing || a.cycleYear > existing.cycleYear) {
      latestByKey.set(key, a);
    }
  }

  const applicable = baselines.filter(
    (b) =>
      employee.salaryGrade >= b.salaryGradeMin &&
      employee.salaryGrade <= b.salaryGradeMax,
  );

  const gaps: TnaGapLike[] = [];
  for (const b of applicable) {
    const key = `${b.domain}::${b.competencyCode}`;
    const latest = latestByKey.get(key);
    const currentLevel =
      latest && typeof latest.score === "number" ? latest.score : 0;
    const gap = b.requiredLevel - currentLevel;
    if (gap > 0) {
      gaps.push({
        employeeId: employee.employeeId,
        domain: b.domain,
        competencyCode: b.competencyCode,
        requiredLevel: b.requiredLevel,
        currentLevel,
        gap,
        cycleYear: employee.cycleYear,
      });
    }
  }

  return gaps;
}

// ─── suggestProgramsForGaps ──────────────────────────────────────────────────

const TOKEN_SPLIT_REGEX = /[\s_\-/]+/g;
const MIN_TOKEN_LENGTH = 3;

function tokenize(source: string): string[] {
  return source
    .toLowerCase()
    .split(TOKEN_SPLIT_REGEX)
    .map((t) => t.trim())
    .filter((t) => t.length >= MIN_TOKEN_LENGTH);
}

function programTokens(p: TrainingProgramLike): Set<string> {
  const parts: string[] = [p.title];
  if (p.description) parts.push(p.description);
  if (p.tags && p.tags.length > 0) parts.push(...p.tags);
  return new Set(tokenize(parts.join(" ")));
}

/**
 * Keyword-match each gap to candidate programs.
 *
 * Matching:
 *  - Tokenize both the competency code + domain (gap side) and the program
 *    title/description/tags (program side).
 *  - A program is suggested when it shares at least one non-trivial token
 *    with the gap.
 *
 * Returns one row per gap, with an empty `suggestedProgramIds` when nothing
 * matches.
 */
export function suggestProgramsForGaps(
  gaps: readonly TnaGapLike[],
  programs: readonly TrainingProgramLike[],
): SuggestionRow[] {
  const indexed = programs.map((p) => ({
    program: p,
    tokens: programTokens(p),
  }));

  return gaps.map((gap) => {
    const gapTokens = new Set(tokenize(`${gap.competencyCode} ${gap.domain}`));
    const suggestedProgramIds: string[] = [];
    for (const entry of indexed) {
      for (const t of gapTokens) {
        if (entry.tokens.has(t)) {
          suggestedProgramIds.push(entry.program.id);
          break;
        }
      }
    }
    return { gap, suggestedProgramIds };
  });
}
