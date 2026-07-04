/**
 * Loading skeleton for /attendance/approvals (supervisor queue).
 */

export default function AttendanceApprovalsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 h-10 w-72 animate-pulse rounded bg-[#0B2545]/10" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="mb-4 h-44 animate-pulse rounded-xl border border-[#0B2545]/5 bg-[#0B2545]/[0.02]"
        />
      ))}
    </main>
  );
}
