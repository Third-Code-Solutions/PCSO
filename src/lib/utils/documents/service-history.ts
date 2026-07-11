/**
 * Service Record history assembly (TOR 1.3.8 / PIM-012).
 *
 * Pure reconstruction of an employee's chronological service history from the
 * data the system actually holds today:
 *
 *   - appointments        → full state changes (position, status, salary, office)
 *   - step increments     → salary change within the same appointment (NOSI)
 *   - salary adjustments  → salary change within the same appointment (NOSA)
 *
 * Honest fallback: when no appointment history exists (older employees whose
 * 201 file only carries current-state data), the current appointment renders
 * as a single row from `dateHired` to Present. No history is invented.
 *
 * All dates are ISO strings (YYYY-MM-DD). No DB, no env, no I/O — unit tested
 * in service-history.test.ts.
 */

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface ServiceHistoryEmployee {
  positionTitle: string;
  appointmentType: string;
  /** ISO date (YYYY-MM-DD). */
  dateHired: string;
  /** Monthly basic salary in PHP, when resolvable. */
  monthlySalary?: number | null;
  officeName?: string | null;
  /** employees.status — separated statuses close the final period. */
  status: string;
  /** ISO date of separation when known (resigned/retired/etc.). */
  separationDate?: string | null;
}

export interface ServiceHistoryAppointment {
  /** ISO date. */
  effectivityDate: string;
  endDate?: string | null;
  positionTitle: string;
  appointmentType: string;
  monthlySalary?: number | null;
  officeName?: string | null;
}

export interface ServiceHistoryStepIncrement {
  /** ISO date. */
  effectivityDate: string;
  fromStep: number;
  toStep: number;
  /** Resolved monthly salary at the new step, when derivable. */
  monthlySalary?: number | null;
}

export interface ServiceHistorySalaryAdjustment {
  /** ISO date. */
  effectiveDate: string;
  adjustmentType: string;
  newSalary?: number | null;
}

export interface BuildServiceHistoryInput {
  employee: ServiceHistoryEmployee;
  appointments?: ServiceHistoryAppointment[];
  stepIncrements?: ServiceHistoryStepIncrement[];
  salaryAdjustments?: ServiceHistorySalaryAdjustment[];
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface ServiceRecordRow {
  /** ISO date. */
  dateFrom: string;
  /** ISO date, or null = "Present". */
  dateTo: string | null;
  designation: string;
  /** Appointment status label (Permanent, Temporary, ...). */
  statusLabel: string;
  /** Monthly basic salary in PHP; null when not derivable. */
  salary: number | null;
  /** Station / place of assignment (office name). */
  station: string;
  /** Leave-without-pay column — blank unless supplied upstream. */
  lwop: string;
  /** Cause / remarks (e.g. "Step Increment", "Promotion"). */
  remarks: string;
}

// ─── Internals ────────────────────────────────────────────────────────────────

interface TimelineEvent {
  date: string;
  kind: "appointment" | "step_increment" | "salary_adjustment";
  order: number;
  designation?: string;
  statusLabel?: string;
  salary?: number | null;
  station?: string | null;
  remarks: string;
}

const SEPARATED_STATUSES = new Set([
  "resigned",
  "retired",
  "terminated",
  "deceased",
]);

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Day before an ISO date, computed in UTC to avoid TZ drift. */
export function dayBefore(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── Assembly ─────────────────────────────────────────────────────────────────

export function buildServiceHistory(
  input: BuildServiceHistoryInput,
): ServiceRecordRow[] {
  const { employee } = input;
  const appointments = [...(input.appointments ?? [])].sort((a, b) =>
    a.effectivityDate.localeCompare(b.effectivityDate),
  );

  const events: TimelineEvent[] = [];
  let order = 0;

  if (appointments.length > 0) {
    for (const appt of appointments) {
      events.push({
        date: appt.effectivityDate,
        kind: "appointment",
        order: order++,
        designation: appt.positionTitle,
        statusLabel: titleCase(appt.appointmentType),
        salary: appt.monthlySalary ?? null,
        station: appt.officeName ?? null,
        remarks: "Appointment",
      });
    }
  } else {
    // Honest fallback — current-state data only.
    events.push({
      date: employee.dateHired,
      kind: "appointment",
      order: order++,
      designation: employee.positionTitle,
      statusLabel: titleCase(employee.appointmentType),
      salary: employee.monthlySalary ?? null,
      station: employee.officeName ?? null,
      remarks: "Original Appointment",
    });
  }

  const firstDate = events[0]!.date;

  for (const inc of input.stepIncrements ?? []) {
    if (inc.effectivityDate < firstDate) continue;
    events.push({
      date: inc.effectivityDate,
      kind: "step_increment",
      order: order++,
      salary: inc.monthlySalary ?? null,
      remarks: `Step Increment (Step ${inc.fromStep} to ${inc.toStep})`,
    });
  }

  for (const adj of input.salaryAdjustments ?? []) {
    if (adj.effectiveDate < firstDate) continue;
    events.push({
      date: adj.effectiveDate,
      kind: "salary_adjustment",
      order: order++,
      salary: adj.newSalary ?? null,
      remarks: `Salary Adjustment (${titleCase(adj.adjustmentType)})`,
    });
  }

  // Chronological; stable for same-day events (appointments first by `order`).
  events.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

  // Fold events into rows, carrying state forward across salary-only events.
  const rows: ServiceRecordRow[] = [];
  let current: ServiceRecordRow | null = null;

  for (const event of events) {
    const next: ServiceRecordRow = {
      dateFrom: event.date,
      dateTo: null,
      designation:
        event.designation ?? current?.designation ?? employee.positionTitle,
      statusLabel:
        event.statusLabel ??
        current?.statusLabel ??
        titleCase(employee.appointmentType),
      salary: event.salary ?? current?.salary ?? null,
      station: event.station ?? current?.station ?? employee.officeName ?? "",
      lwop: "",
      remarks: event.remarks,
    };

    if (current) {
      if (current.dateFrom === next.dateFrom) {
        // Same-day event supersedes the open row (e.g. appointment + adjustment).
        rows.pop();
      } else {
        current.dateTo = dayBefore(next.dateFrom);
      }
    }

    rows.push(next);
    current = next;
  }

  // Close the final period on separation, when known.
  if (current) {
    if (SEPARATED_STATUSES.has(employee.status)) {
      current.dateTo = employee.separationDate ?? null;
      current.remarks = current.remarks
        ? `${current.remarks}; ${titleCase(employee.status)}`
        : titleCase(employee.status);
    }
  }

  return rows;
}
