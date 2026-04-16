/**
 * Loading skeleton for /attendance/timesheets (period list).
 */

export default function TimesheetsListLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 h-10 w-48 animate-pulse rounded bg-[#0B2545]/10" />
      <div className="overflow-hidden rounded-xl border border-[#0B2545]/10 bg-white shadow-sm">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse border-b border-[#0B2545]/5 bg-[#0B2545]/[0.02] last:border-0"
          />
        ))}
      </div>
    </main>
  );
}
