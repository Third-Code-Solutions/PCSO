import "server-only";

/**
 * Work-schedule assignment loading — TAM-001 (H-13).
 *
 * Single DB loader for `employee_schedules` / `office_schedules` joined to
 * `work_schedules`. Resolution order is employee → office → default
 * (DEFAULT_AGENCY_SCHEDULE), via the pure `pickApplicableSchedule`.
 *
 * Used by the biometric ingest pipeline, the DTR / CSC Form 48 export, the
 * attendance-notifications cron and the shift-change portal.
 */

import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  employeeSchedules,
  officeSchedules,
  workSchedules,
} from "@/lib/db/schema";
import { pickApplicableSchedule } from "@/lib/utils/attendance/schedule-resolution";
import type { WorkScheduleRow } from "@/lib/utils/attendance/schedule-mapping";

export interface ResolvedScheduleAssignment {
  scheduleId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  schedule: WorkScheduleRow & {
    code: string;
    name: string;
    applicableDays: unknown;
  };
}

export interface ScheduleAssignmentMaps {
  byEmployee: Map<string, ResolvedScheduleAssignment[]>;
  byOffice: Map<string, ResolvedScheduleAssignment[]>;
}

const scheduleColumns = {
  code: workSchedules.code,
  name: workSchedules.name,
  timeIn: workSchedules.timeIn,
  timeOut: workSchedules.timeOut,
  breakStart: workSchedules.breakStart,
  breakEnd: workSchedules.breakEnd,
  gracePeriodMinutes: workSchedules.gracePeriodMinutes,
  applicableDays: workSchedules.applicableDays,
};

type AssignmentQueryRow = {
  ownerId: string;
  scheduleId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  code: string;
  name: string;
  timeIn: string;
  timeOut: string;
  breakStart: string | null;
  breakEnd: string | null;
  gracePeriodMinutes: number;
  applicableDays: unknown;
};

function groupByOwner(
  rows: readonly AssignmentQueryRow[],
): Map<string, ResolvedScheduleAssignment[]> {
  const map = new Map<string, ResolvedScheduleAssignment[]>();
  for (const row of rows) {
    const list = map.get(row.ownerId) ?? [];
    list.push({
      scheduleId: row.scheduleId,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      schedule: {
        code: row.code,
        name: row.name,
        timeIn: row.timeIn,
        timeOut: row.timeOut,
        breakStart: row.breakStart,
        breakEnd: row.breakEnd,
        gracePeriodMinutes: row.gracePeriodMinutes,
        applicableDays: row.applicableDays,
      },
    });
    map.set(row.ownerId, list);
  }
  return map;
}

/**
 * Batch-loads every assignment overlapping [minDate, maxDate] for the given
 * employees and offices. Two queries regardless of input size.
 */
export async function loadScheduleAssignments(
  employeeIds: readonly string[],
  officeIds: readonly string[],
  minDate: string,
  maxDate: string,
): Promise<ScheduleAssignmentMaps> {
  const [empRows, officeRows] = await Promise.all([
    employeeIds.length === 0
      ? Promise.resolve([] as AssignmentQueryRow[])
      : db
          .select({
            ownerId: employeeSchedules.employeeId,
            scheduleId: employeeSchedules.scheduleId,
            effectiveFrom: employeeSchedules.effectiveFrom,
            effectiveTo: employeeSchedules.effectiveTo,
            ...scheduleColumns,
          })
          .from(employeeSchedules)
          .innerJoin(
            workSchedules,
            eq(employeeSchedules.scheduleId, workSchedules.id),
          )
          .where(
            and(
              inArray(employeeSchedules.employeeId, [...employeeIds]),
              lte(employeeSchedules.effectiveFrom, maxDate),
              or(
                isNull(employeeSchedules.effectiveTo),
                gte(employeeSchedules.effectiveTo, minDate),
              ),
            ),
          ),
    officeIds.length === 0
      ? Promise.resolve([] as AssignmentQueryRow[])
      : db
          .select({
            ownerId: officeSchedules.officeId,
            scheduleId: officeSchedules.scheduleId,
            effectiveFrom: officeSchedules.effectiveFrom,
            effectiveTo: officeSchedules.effectiveTo,
            ...scheduleColumns,
          })
          .from(officeSchedules)
          .innerJoin(
            workSchedules,
            eq(officeSchedules.scheduleId, workSchedules.id),
          )
          .where(
            and(
              inArray(officeSchedules.officeId, [...officeIds]),
              lte(officeSchedules.effectiveFrom, maxDate),
              or(
                isNull(officeSchedules.effectiveTo),
                gte(officeSchedules.effectiveTo, minDate),
              ),
            ),
          ),
  ]);

  return {
    byEmployee: groupByOwner(empRows),
    byOffice: groupByOwner(officeRows),
  };
}

/** Resolves the assignment for one employee on one date (employee → office). */
export function pickFromMaps(
  maps: ScheduleAssignmentMaps,
  employeeId: string,
  officeId: string | null,
  date: string,
): ResolvedScheduleAssignment | null {
  return pickApplicableSchedule({
    date,
    employeeAssignments: maps.byEmployee.get(employeeId) ?? [],
    officeAssignments: officeId ? (maps.byOffice.get(officeId) ?? []) : [],
  });
}

/**
 * Applicable assignment for one employee on `date`, or null when neither the
 * employee nor the office has one (callers fall back to the agency default).
 */
export async function resolveEmployeeScheduleOn(
  employeeId: string,
  officeId: string | null,
  date: string,
): Promise<ResolvedScheduleAssignment | null> {
  const maps = await loadScheduleAssignments(
    [employeeId],
    officeId ? [officeId] : [],
    date,
    date,
  );
  return pickFromMaps(maps, employeeId, officeId, date);
}
