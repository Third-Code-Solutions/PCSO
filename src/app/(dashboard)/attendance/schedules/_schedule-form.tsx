"use client";

/**
 * ScheduleForm — Shared form for creating/editing work schedules (TAM-001).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WorkSchedule } from "@/lib/db/schema/attendance";

interface ScheduleFormProps {
  schedule?: WorkSchedule;
}

const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function ScheduleForm({ schedule }: ScheduleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Parse applicable days from JSON or default to Mon-Fri
  const defaultDays = schedule?.applicableDays
    ? (JSON.parse(JSON.stringify(schedule.applicableDays)) as number[])
    : [1, 2, 3, 4, 5];

  const [applicableDays, setApplicableDays] = useState<number[]>(defaultDays);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("applicableDays", JSON.stringify(applicableDays));

    startTransition(async () => {
      try {
        const res = await fetch("/api/attendance/schedules", {
          method: schedule ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: schedule?.id,
            code: formData.get("code"),
            name: formData.get("name"),
            timeIn: formData.get("timeIn"),
            timeOut: formData.get("timeOut"),
            breakStart: formData.get("breakStart") || null,
            breakEnd: formData.get("breakEnd") || null,
            totalHours: formData.get("totalHours"),
            gracePeriodMinutes: Number(formData.get("gracePeriodMinutes")),
            applicableDays,
            isActive: formData.get("isActive") === "on",
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to save schedule");
        }

        router.push("/attendance/schedules");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
    });
  };

  const toggleDay = (day: number) => {
    setApplicableDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort(),
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[#0B2545]/10 bg-white p-6 shadow-sm"
    >
      {error && (
        <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Code and Name */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-gray-700"
            >
              Schedule Code *
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              defaultValue={schedule?.code}
              placeholder="FLEX-9-5"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Schedule Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={schedule?.name}
              placeholder="Flexible 9-5"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
            />
          </div>
        </div>

        {/* Time In / Out */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="timeIn"
              className="block text-sm font-medium text-gray-700"
            >
              Time In *
            </label>
            <input
              id="timeIn"
              name="timeIn"
              type="time"
              required
              defaultValue={schedule?.timeIn}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="timeOut"
              className="block text-sm font-medium text-gray-700"
            >
              Time Out *
            </label>
            <input
              id="timeOut"
              name="timeOut"
              type="time"
              required
              defaultValue={schedule?.timeOut}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
            />
          </div>
        </div>

        {/* Break Times */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="breakStart"
              className="block text-sm font-medium text-gray-700"
            >
              Break Start (optional)
            </label>
            <input
              id="breakStart"
              name="breakStart"
              type="time"
              defaultValue={schedule?.breakStart ?? ""}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="breakEnd"
              className="block text-sm font-medium text-gray-700"
            >
              Break End (optional)
            </label>
            <input
              id="breakEnd"
              name="breakEnd"
              type="time"
              defaultValue={schedule?.breakEnd ?? ""}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
            />
          </div>
        </div>

        {/* Total Hours & Grace Period */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="totalHours"
              className="block text-sm font-medium text-gray-700"
            >
              Total Hours *
            </label>
            <input
              id="totalHours"
              name="totalHours"
              type="number"
              step="0.01"
              required
              defaultValue={schedule?.totalHours}
              placeholder="8.00"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="gracePeriodMinutes"
              className="block text-sm font-medium text-gray-700"
            >
              Grace Period (minutes) *
            </label>
            <input
              id="gracePeriodMinutes"
              name="gracePeriodMinutes"
              type="number"
              required
              defaultValue={schedule?.gracePeriodMinutes ?? 0}
              placeholder="15"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
            />
          </div>
        </div>

        {/* Applicable Days */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Applicable Days *
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DAYS.map((day) => (
              <label
                key={day.value}
                className="flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={applicableDays.includes(day.value)}
                  onChange={() => toggleDay(day.value)}
                  className="h-4 w-4 rounded border-gray-300 text-[#C8A84B] focus:ring-[#C8A84B]"
                />
                {day.label}
              </label>
            ))}
          </div>
        </div>

        {/* Active Status */}
        <div className="flex items-center gap-2">
          <input
            id="isActive"
            name="isActive"
            type="checkbox"
            defaultChecked={schedule?.isActive ?? true}
            className="h-4 w-4 rounded border-gray-300 text-[#C8A84B] focus:ring-[#C8A84B]"
          />
          <label
            htmlFor="isActive"
            className="text-sm font-medium text-gray-700"
          >
            Active
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-[#0B2545] px-4 py-2 text-sm font-medium text-[#FAF4E6] hover:bg-[#13315C] disabled:opacity-50"
        >
          {isPending
            ? "Saving..."
            : schedule
              ? "Update Schedule"
              : "Create Schedule"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
