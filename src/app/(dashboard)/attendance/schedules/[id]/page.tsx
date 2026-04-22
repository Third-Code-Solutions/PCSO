/**
 * /attendance/schedules/[id] — Edit work schedule (TAM-001).
 */

import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { workSchedules } from "@/lib/db/schema/attendance";
import { eq } from "drizzle-orm";
import { ScheduleForm } from "../_schedule-form";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Edit Work Schedule" };

export default async function EditSchedulePage({ params }: PageProps) {
  await requirePermission("attendance", "approve");
  const { id } = await params;

  const schedule = await db.query.workSchedules
    .findFirst({
      where: eq(workSchedules.id, id),
    })
    .catch(() => null);

  if (!schedule) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2545]">
          Edit Work Schedule
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Update schedule: {schedule.name} ({schedule.code})
        </p>
      </div>

      <ScheduleForm schedule={schedule} />
    </main>
  );
}
