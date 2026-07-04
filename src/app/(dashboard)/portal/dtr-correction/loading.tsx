/**
 * Loading skeleton for /portal/dtr-correction.
 */

export default function DtrCorrectionLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="h-10 w-72 animate-pulse rounded bg-[#0B2545]/10" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-48 animate-pulse rounded-xl border border-[#0B2545]/5 bg-[#0B2545]/[0.02]"
        />
      ))}
    </div>
  );
}
