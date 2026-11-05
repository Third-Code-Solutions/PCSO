/**
 * /attendance/schedules/assignments — Work-schedule assignments (TAM-001, H-13).
 *
 * HR assigns FM work schedules to offices (default for everyone in the unit)
 * and to individual employees (overrides the office). Tardiness, DTR /
 * CSC Form 48 and absence notices resolve employee → office → agency default.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  employees,
  employeeSchedules,
  offices,
  officeSchedules,
  workSchedules,
} from "@/lib/db/schema";
import {
  assignWorkSchedule,
  deleteWorkScheduleAssignment,
  endWorkScheduleAssignment,
} from "@/lib/actions/attendance/schedule-assignments";

export const metadata = { title: "Schedule Assignments" };

const PATH = "/attendance/schedules/assignments";

interface PageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

function resultUrl(result: { ok: true } | { error: string }): string {
  return "error" in result
    ? `${PATH}?error=${encodeURIComponent(result.error)}`
    : `${PATH}?ok=1`;
}

async function assignAction(formData: FormData) {
  "use server";
  const result = await assignWorkSchedule({
    target: formData.get("target"),
    ownerId: formData.get("ownerId"),
    scheduleId: formData.get("scheduleId"),
    effectiveFrom: formData.get("effectiveFrom"),
  });
  redirect(resultUrl(result));
}

async function endAction(formData: FormData) {
  "use server";
  const result = await endWorkScheduleAssignment({
    target: formData.get("target"),
    assignmentId: formData.get("assignmentId"),
    effectiveTo: formData.get("effectiveTo"),
  });
  redirect(resultUrl(result));
}

async function deleteAction(formData: FormData) {
  "use server";
  const result = await deleteWorkScheduleAssignment({
    target: formData.get("target"),
    assignmentId: formData.get("assignmentId"),
  });
  redirect(resultUrl(result));
}

const inputClass =
  "mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none";
const labelClass = "block text-xs font-medium text-gray-500";
const thClass =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600";
const primaryButton =
  "rounded bg-[#0B2545] px-4 py-2 text-sm font-medium text-[#FAF4E6] hover:bg-[#13315C]";

export default async function ScheduleAssignmentsPage({
  searchParams,
}: PageProps) {
  await requirePermission("attendance", "edit");
  const params = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });

  const current = or(
    isNull(officeSchedules.effectiveTo),
    gte(officeSchedules.effectiveTo, today),
  );
  const currentEmp = or(
    isNull(employeeSchedules.effectiveTo),
    gte(employeeSchedules.effectiveTo, today),
  );

  const [scheduleOptions, officeOptions, employeeOptions, officeRows, empRows] =
    await Promise.all([
      db
        .select({
          id: workSchedules.id,
          code: workSchedules.code,
          name: workSchedules.name,
          timeIn: workSchedules.timeIn,
          timeOut: workSchedules.timeOut,
        })
        .from(workSchedules)
        .where(
          and(
            eq(workSchedules.isActive, true),
            isNull(workSchedules.deletedAt),
          ),
        )
        .orderBy(asc(workSchedules.code)),
      db
        .select({ id: offices.id, code: offices.code, name: offices.name })
        .from(offices)
        .where(isNull(offices.deletedAt))
        .orderBy(asc(offices.name)),
      db
        .select({
          id: employees.id,
          employeeNo: employees.employeeNo,
          lastName: employees.lastName,
          firstName: employees.firstName,
        })
        .from(employees)
        .where(inArray(employees.status, ["active", "on_leave", "suspended"]))
        .orderBy(asc(employees.lastName), asc(employees.firstName)),
      db
        .select({
          id: officeSchedules.id,
          officeName: offices.name,
          scheduleCode: workSchedules.code,
          scheduleName: workSchedules.name,
          effectiveFrom: officeSchedules.effectiveFrom,
          effectiveTo: officeSchedules.effectiveTo,
        })
        .from(officeSchedules)
        .innerJoin(offices, eq(officeSchedules.officeId, offices.id))
        .innerJoin(
          workSchedules,
          eq(officeSchedules.scheduleId, workSchedules.id),
        )
        .where(current)
        .orderBy(asc(offices.name), desc(officeSchedules.effectiveFrom)),
      db
        .select({
          id: employeeSchedules.id,
          employeeNo: employees.employeeNo,
          lastName: employees.lastName,
          firstName: employees.firstName,
          scheduleCode: workSchedules.code,
          scheduleName: workSchedules.name,
          effectiveFrom: employeeSchedules.effectiveFrom,
          effectiveTo: employeeSchedules.effectiveTo,
        })
        .from(employeeSchedules)
        .innerJoin(employees, eq(employeeSchedules.employeeId, employees.id))
        .innerJoin(
          workSchedules,
          eq(employeeSchedules.scheduleId, workSchedules.id),
        )
        .where(currentEmp)
        .orderBy(
          asc(employees.lastName),
          desc(employeeSchedules.effectiveFrom),
        ),
    ]);

  const scheduleSelect = (
    <select name="scheduleId" required className={inputClass} defaultValue="">
      <option value="" disabled>
        Select schedule…
      </option>
      {scheduleOptions.map((s) => (
        <option key={s.id} value={s.id}>
          {s.code} — {s.name} ({s.timeIn.slice(0, 5)}–{s.timeOut.slice(0, 5)})
        </option>
      ))}
    </select>
  );

  // Not yet in effect -> delete; in effect -> end (keeps the history).
  const rowAction = (
    target: "office" | "employee",
    assignmentId: string,
    effectiveFrom: string,
  ) =>
    effectiveFrom > today ? (
      <form action={deleteAction} className="flex justify-end">
        <input type="hidden" name="target" value={target} />
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <button
          type="submit"
          className="text-sm font-medium text-red-700 hover:underline"
        >
          Delete (not yet in effect)
        </button>
      </form>
    ) : (
      endForm(target, assignmentId)
    );

  const endForm = (target: "office" | "employee", assignmentId: string) => (
    <form action={endAction} className="flex items-center justify-end gap-2">
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <label className="sr-only" htmlFor={`end-${assignmentId}`}>
        End date
      </label>
      <input
        id={`end-${assignmentId}`}
        type="date"
        name="effectiveTo"
        required
        defaultValue={today}
        className="rounded border border-gray-300 px-2 py-1 text-xs"
      />
      <button
        type="submit"
        className="text-sm font-medium text-[#C8A84B] hover:underline"
      >
        End
      </button>
    </form>
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2545]">
            Schedule Assignments
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Office schedules apply to everyone in the unit; employee assignments
            override them. Unassigned staff use the agency default (8:00–5:00,
            Mon–Fri). (TAM-001)
          </p>
        </div>
        <Link
          href="/attendance/schedules"
          className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Work Schedules
        </Link>
      </div>

      {params.error && (
        <p
          role="alert"
          className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {params.error}
        </p>
      )}
      {params.ok && (
        <p
          role="status"
          className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          Assignment saved.
        </p>
      )}

      {/* Office assignments */}
      <section className="mb-8" aria-labelledby="office-heading">
        <h2
          id="office-heading"
          className="mb-3 text-lg font-semibold text-[#0B2545]"
        >
          Office schedules
        </h2>
        <form
          action={assignAction}
          className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-[#0B2545]/10 bg-white p-4 shadow-sm sm:grid-cols-12"
        >
          <input type="hidden" name="target" value="office" />
          <div className="sm:col-span-4">
            <label className={labelClass}>
              Office
              <select
                name="ownerId"
                required
                className={inputClass}
                defaultValue=""
              >
                <option value="" disabled>
                  Select office…
                </option>
                {officeOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.code})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="sm:col-span-4">
            <label className={labelClass}>
              Schedule
              {scheduleSelect}
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>
              Effective from
              <input
                type="date"
                name="effectiveFrom"
                required
                defaultValue={today}
                className={inputClass}
              />
            </label>
          </div>
          <div className="flex items-end sm:col-span-2">
            <button type="submit" className={primaryButton}>
              Assign
            </button>
          </div>
        </form>

        <div className="overflow-x-auto rounded-xl border border-[#0B2545]/10 bg-white shadow-sm">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className={thClass}>Office</th>
                <th className={thClass}>Schedule</th>
                <th className={thClass}>From</th>
                <th className={thClass}>To</th>
                <th className={`${thClass} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {officeRows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    No office schedules assigned yet.
                  </td>
                </tr>
              )}
              {officeRows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.officeName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <span className="font-mono text-[#0B2545]">
                      {r.scheduleCode}
                    </span>{" "}
                    {r.scheduleName}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-gray-600">
                    {r.effectiveFrom}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-gray-600">
                    {r.effectiveTo ?? "Onward"}
                  </td>
                  <td className="px-4 py-3">
                    {rowAction("office", r.id, r.effectiveFrom)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Employee overrides */}
      <section aria-labelledby="employee-heading">
        <h2
          id="employee-heading"
          className="mb-3 text-lg font-semibold text-[#0B2545]"
        >
          Employee overrides
        </h2>
        <form
          action={assignAction}
          className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-[#0B2545]/10 bg-white p-4 shadow-sm sm:grid-cols-12"
        >
          <input type="hidden" name="target" value="employee" />
          <div className="sm:col-span-4">
            <label className={labelClass}>
              Employee
              <select
                name="ownerId"
                required
                className={inputClass}
                defaultValue=""
              >
                <option value="" disabled>
                  Select employee…
                </option>
                {employeeOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.lastName}, {e.firstName} ({e.employeeNo})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="sm:col-span-4">
            <label className={labelClass}>
              Schedule
              {scheduleSelect}
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>
              Effective from
              <input
                type="date"
                name="effectiveFrom"
                required
                defaultValue={today}
                className={inputClass}
              />
            </label>
          </div>
          <div className="flex items-end sm:col-span-2">
            <button type="submit" className={primaryButton}>
              Assign
            </button>
          </div>
        </form>

        <div className="overflow-x-auto rounded-xl border border-[#0B2545]/10 bg-white shadow-sm">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className={thClass}>Employee</th>
                <th className={thClass}>Schedule</th>
                <th className={thClass}>From</th>
                <th className={thClass}>To</th>
                <th className={`${thClass} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {empRows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    No employee overrides. Everyone follows their office
                    schedule.
                  </td>
                </tr>
              )}
              {empRows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.lastName}, {r.firstName}{" "}
                    <span className="text-gray-400">({r.employeeNo})</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <span className="font-mono text-[#0B2545]">
                      {r.scheduleCode}
                    </span>{" "}
                    {r.scheduleName}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-gray-600">
                    {r.effectiveFrom}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-gray-600">
                    {r.effectiveTo ?? "Onward"}
                  </td>
                  <td className="px-4 py-3">
                    {rowAction("employee", r.id, r.effectiveFrom)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
