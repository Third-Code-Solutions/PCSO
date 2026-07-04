/**
 * Loading skeleton for /attendance/shift-changes (HR queue).
 */

export default function ShiftChangesQueueLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 h-10 w-72 animate-pulse rounded bg-[#0B2545]/10" />
      <div className="mb-4 h-8 w-96 animate-pulse rounded bg-[#0B2545]/[0.06]" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="mb-4 h-40 animate-pulse rounded-xl border border-[#0B2545]/5 bg-[#0B2545]/[0.02]"
        />
      ))}
    </main>
  );
}
