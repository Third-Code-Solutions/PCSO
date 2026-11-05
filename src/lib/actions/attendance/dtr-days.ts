import "server-only";

/**
 * DTR / CSC Form 48 month context — TAM-007 / TAM-008 (H-40).
 *
 * Loads the employee's resolved schedules (employee → office → agency
 * default), holidays, approved leaves and active work suspensions for one
 * month, then builds the per-day Form 48 rows via the pure `buildDtrDays`.
 */

import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  fmWorkSuspensions,
  holidays,
  leaveApplications,
  leaveTypes,
} from "@/lib/db/schema";
import { DEFAULT_AGENCY_SCHEDULE } from "@/lib/constants/work-schedule";
import { isRestDay } from "@/lib/utils/attendance/day-context";
import {
  DEFAULT_APPLICABLE_DAYS,
  normalizeApplicableDays,
} from "@/lib/utils/attendance/schedule-resolution";
import {
  buildDtrDays,
  daysInMonth,
  scheduleLabel,
  type DtrDay,
  type DtrLogInput,
} from "@/lib/utils/attendance/dtr-calendar";
import { loadScheduleAssignments, pickFromMaps } from "./schedule-context";

/**
 * Leave statuses that mean the employee was on leave that day.
 * cancellation_requested stays approved until the approver confirms.
 */
const ON_LEAVE_STATUSES = [
  "approved",
  "cancellation_requested",
  "consumed",
  "consumed_auto",
] as const;

export interface DtrMonth {
  days: DtrDay[];
  /** e.g. "8:00 AM – 5:00 PM" (several joined by "; " if it changed mid-month) */
  scheduleLabel: string;
}

export async function loadDtrMonth(input: {
  employeeId: string;
  officeId: string | null;
  year: number;
  month: number;
  logs: readonly DtrLogInput[];
}): Promise<DtrMonth> {
  const { employeeId, officeId, year, month } = input;
  const mm = String(month).padStart(2, "0");
  const start = `${year}-${mm}-01`;
  const end = `${year}-${mm}-${String(daysInMonth(year, month)).padStart(2, "0")}`;

  const [maps, holidayRows, leaveRows, suspensionRows] = await Promise.all([
    loadScheduleAssignments(
      [employeeId],
      officeId ? [officeId] : [],
      start,
      end,
    ),
    db
      .select({
        date: holidays.holidayDate,
        name: holidays.name,
        type: holidays.type,
      })
      .from(holidays)
      .where(
        and(gte(holidays.holidayDate, start), lte(holidays.holidayDate, end)),
      ),
    db
      .select({
        dateFrom: leaveApplications.dateFrom,
        dateTo: leaveApplications.dateTo,
        label: leaveTypes.name,
      })
      .from(leaveApplications)
      .innerJoin(leaveTypes, eq(leaveApplications.leaveTypeId, leaveTypes.id))
      .where(
        and(
          eq(leaveApplications.employeeId, employeeId),
          inArray(leaveApplications.status, [...ON_LEAVE_STATUSES]),
          lte(leaveApplications.dateFrom, end),
          gte(leaveApplications.dateTo, start),
        ),
      ),
    db
      .select({
        applicableDate: fmWorkSuspensions.applicableDate,
        applicableHours: fmWorkSuspensions.applicableHours,
        isActive: fmWorkSuspensions.isActive,
      })
      .from(fmWorkSuspensions)
      .where(
        and(
          gte(fmWorkSuspensions.applicableDate, start),
          lte(fmWorkSuspensions.applicableDate, end),
          eq(fmWorkSuspensions.isActive, true),
          isNull(fmWorkSuspensions.deletedAt),
        ),
      ),
  ]);

  const scheduleOn = (date: string) =>
    pickFromMaps(maps, employeeId, officeId, date)?.schedule ?? null;

  const days = buildDtrDays({
    year,
    month,
    logs: input.logs,
    holidays: holidayRows,
    leaves: leaveRows,
    suspensions: suspensionRows,
    isRestDay: (date) => {
      const schedule = scheduleOn(date);
      return isRestDay(
        date,
        schedule
          ? normalizeApplicableDays(schedule.applicableDays)
          : DEFAULT_APPLICABLE_DAYS,
      );
    },
  });

  const schedules = days.map(
    (d) =>
      scheduleOn(d.date) ?? {
        timeIn: DEFAULT_AGENCY_SCHEDULE.scheduledStart,
        timeOut: DEFAULT_AGENCY_SCHEDULE.scheduledEnd,
      },
  );

  return { days, scheduleLabel: scheduleLabel(schedules) };
}
