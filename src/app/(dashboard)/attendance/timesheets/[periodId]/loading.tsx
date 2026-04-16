/**
 * Loading skeleton for /attendance/timesheets/[periodId].
 *
 * Rendered while the server component is fetching the paginated detail.
 */

export default function TimesheetDetailLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 h-10 w-64 animate-pulse rounded bg-[#0B2545]/10" />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl bg-[#0B2545]/10"
          />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-xl bg-[#0B2545]/10" />
    </main>
  );
}
