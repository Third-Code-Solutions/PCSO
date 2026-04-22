/**
 * /attendance/schedules/new — Create new work schedule (TAM-001).
 */

import { requirePermission } from "@/lib/auth/guards";
import { ScheduleForm } from "../_schedule-form";

export const metadata = { title: "New Work Schedule" };

export default async function NewSchedulePage() {
  await requirePermission("attendance", "approve");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2545]">New Work Schedule</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Configure shift times, grace periods, and break windows (TAM-001)
        </p>
      </div>

      <ScheduleForm />
    </main>
  );
}
