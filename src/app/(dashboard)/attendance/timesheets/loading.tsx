/**
 * Loading skeleton for /attendance/timesheets (period list).
 */

export default function TimesheetsListLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0B2545]">Timesheets</h1>
        <p className="mt-1 text-sm text-gray-500">
          Loading the latest DTR periods...
        </p>
      </div>
      <div
        className="overflow-hidden rounded-xl border border-[#0B2545]/10 bg-white shadow-sm"
        aria-label="Loading timesheet periods"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse border-b border-[#0B2545]/5 bg-[#0B2545]/[0.02] last:border-0"
          />
        ))}
      </div>
    </main>
  );
}
