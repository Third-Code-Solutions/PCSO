/**
 * LDM schedule generator + shared domain types.
 *
 * Pure helpers (no I/O) plus the TrainingRun / TrainingParticipant value
 * types used by the LDM server-action layer. Types live here (rather than
 * in the server-action files) because Next.js server action modules can
 * only export async functions — sibling pure modules are the canonical
 * home for shared types.
 *
 * Scope:
 *   - LDM-004 (Propose schedule)
 *   - LDM-006 (Conflict detection)
 *   - Shared types used by LDM-005 / LDM-008 / LDM-009
 */

// ─── Program / provider inputs ───────────────────────────────────────────────

export interface ProgramLike {
  id: string;
  name: string;
  durationDays: number;
}

export interface WeeklySlot {
  /** 0 = Sunday, 1 = Monday, ... 6 = Saturday. */
  dayOfWeek: number;
  /** Default venue associated with this availability slot. */
  venue: string;
}

export interface ProviderAvailability {
  weeklySlots: readonly WeeklySlot[];
}

export interface ProposedSchedule {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  venue: string;
  participantTargetCount: number;
}

// ─── Run / participant domain types ──────────────────────────────────────────

export type RunStatus =
  | "draft"
  | "for_approval"
  | "approved"
  | "in_progress"
  | "completed"
  | "cancelled";

export type ParticipantStatus = "nominated" | "confirmed" | "removed";

export type ApprovalDecision = "approved" | "returned" | "pending";

export interface TrainingRun {
  id: string;
  programId: string;
  providerId: string;
  startDate: string;
  endDate: string;
  venue: string;
  plannedHeadcount: number;
  perParticipantCost: number;
  venueCost: number;
  facilitatorFees: number;
  totalBudget: number;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingParticipant {
  id: string;
  runId: string;
  employeeId: string;
  employeeName: string | null;
  status: ParticipantStatus;
  nominatedAt: string;
  confirmedAt: string | null;
}

export interface TrainingRunApproval {
  id: string;
  runId: string;
  sequenceOrder: number;
  approverRole: string;
  approverId: string | null;
  decision: ApprovalDecision;
  comments: string | null;
  decidedAt: string | null;
}

// ─── Conflict detection types ────────────────────────────────────────────────

export interface ExistingRunLike {
  id: string;
  startDate: string;
  endDate: string;
  venue: string | null;
  participantEmployeeIds?: readonly string[];
}

export interface Conflict {
  kind: "venue" | "participant";
  runId: string;
  detail: string;
}

export interface GenerateScheduleInput {
  program: Readonly<ProgramLike>;
  providerAvailability: Readonly<ProviderAvailability>;
  participantTargetCount: number;
}

export interface NewRunLike {
  startDate: string;
  endDate: string;
  venue: string | null;
  participantEmployeeIds?: readonly string[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function nextMonthFirstMonday(from: Date): Date {
  const base = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1),
  );
  const offset = (8 - base.getUTCDay()) % 7;
  base.setUTCDate(base.getUTCDate() + offset);
  return base;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Advisory proposal: start = next month's first Monday, end = start + (duration - 1).
 * Venue defaults to the first weekly-slot venue; falls back to 'TBD'.
 */
export function generateProposedSchedule(
  input: Readonly<GenerateScheduleInput>,
): ProposedSchedule {
  const duration = Math.max(1, input.program.durationDays);
  const start = nextMonthFirstMonday(new Date());
  const end = addDays(start, duration - 1);
  const venue = input.providerAvailability.weeklySlots[0]?.venue ?? "TBD";

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    venue,
    participantTargetCount: input.participantTargetCount,
  };
}

/**
 * Detect venue or participant-pool conflicts against existing runs.
 * Returns an empty array when there are no conflicts.
 */
export function checkScheduleConflicts(
  newRun: Readonly<NewRunLike>,
  existingRuns: readonly ExistingRunLike[],
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const existing of existingRuns) {
    if (
      !dateRangesOverlap(
        newRun.startDate,
        newRun.endDate,
        existing.startDate,
        existing.endDate,
      )
    ) {
      continue;
    }

    if (newRun.venue && existing.venue && newRun.venue === existing.venue) {
      conflicts.push({
        kind: "venue",
        runId: existing.id,
        detail: `Venue "${newRun.venue}" already booked ${existing.startDate} – ${existing.endDate}.`,
      });
    }

    const newParticipants = newRun.participantEmployeeIds ?? [];
    const existingParticipants = existing.participantEmployeeIds ?? [];
    if (newParticipants.length > 0 && existingParticipants.length > 0) {
      const existingSet = new Set(existingParticipants);
      const overlap = newParticipants.filter((id) => existingSet.has(id));
      if (overlap.length > 0) {
        conflicts.push({
          kind: "participant",
          runId: existing.id,
          detail: `${overlap.length} participant(s) already nominated to run ${existing.id}.`,
        });
      }
    }
  }

  return conflicts;
}
