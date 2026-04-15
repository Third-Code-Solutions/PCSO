import { getOwnOvertimeRequests } from '../queries';
import type { OvertimeRequestRow } from '../queries';

export const metadata = { title: 'Overtime Requests' };

const STATUS_STYLES: Record<OvertimeRequestRow['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  denied: 'bg-red-100 text-red-700',
  partial: 'bg-blue-100 text-blue-700',
};

const DAY_TYPE_LABELS: Record<string, string> = {
  ordinary: 'Ordinary Day',
  special_non_working: 'Special Non-Working',
  regular_holiday: 'Regular Holiday',
  rest_day: 'Rest Day',
  rest_day_and_special: 'Rest Day + Special',
  rest_day_and_regular_holiday: 'Rest Day + Holiday',
};

export default async function OvertimePage() {
  let requests: OvertimeRequestRow[] = [];
  try {
    requests = await getOwnOvertimeRequests();
  } catch {
    // Not authenticated or fetch error — graceful empty state
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2545]">My Overtime Requests</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Track and manage your overtime applications.
          </p>
        </div>
        <a
          href="/attendance/overtime/new"
          className="rounded-lg bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-[#FAF4E6] hover:bg-[#13315C]"
        >
          New OT Request
        </a>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-[#0B2545]/10 bg-white px-6 py-12 text-center">
          <p className="text-gray-400">No overtime requests found.</p>
          <a
            href="/attendance/overtime/new"
            className="mt-4 inline-block rounded-lg border border-[#C8A84B] px-4 py-2 text-sm font-medium text-[#0B2545] hover:bg-[#FAF4E6]"
          >
            Submit your first request
          </a>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#0B2545]/10">
          <table className="w-full text-sm">
            <thead className="bg-[#0B2545] text-[#FAF4E6]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Day Type</th>
                <th className="px-4 py-3 text-right font-medium">Requested</th>
                <th className="px-4 py-3 text-right font-medium">Approved</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0B2545]/5 bg-white">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-[#FAF4E6]/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{req.date}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {DAY_TYPE_LABELS[req.dayType] ?? req.dayType}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                    {req.requestedMinutes} min
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                    {req.approvedMinutes != null ? `${req.approvedMinutes} min` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[req.status]}`}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {req.supervisorComments ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 rounded-lg border border-[#0B2545]/10 bg-[#FAF4E6] p-4 text-xs text-[#0B2545]/70">
        <p className="font-semibold">OT Premium Rates (per Labor Code and CSC Rules):</p>
        <ul className="mt-2 space-y-1">
          <li>Ordinary Working Day: ×1.25 of hourly rate</li>
          <li>Rest Day / Special Non-Working: ×1.3</li>
          <li>Regular Holiday: ×2.0 base + ×1.3 OT premium = ×2.6</li>
          <li>Rest Day + Regular Holiday: ×2.6 base + ×1.3 OT = ×3.38</li>
        </ul>
        <p className="mt-2 italic">Maximum 4 hours (240 min) per day. Pre-authorization required.</p>
      </div>
    </main>
  );
}
