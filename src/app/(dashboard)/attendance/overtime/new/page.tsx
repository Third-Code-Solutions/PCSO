import { getEmployeeSummaries } from '../../queries';
import { OvertimeForm } from '@/components/attendance/overtime-form';
import { createServerClient } from '@/lib/supabase/server';

export const metadata = { title: 'New Overtime Request' };

export default async function NewOvertimePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const employees = await getEmployeeSummaries().catch(() => []);

  // Build supervisor list: all employees except current user
  const supervisors = employees
    .filter((e) => e.id !== user?.id)
    .map((e) => ({ id: e.id, name: `${e.lastName}, ${e.firstName}` }));

  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12 text-center text-sm text-gray-500">
        You must be logged in to submit an overtime request.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6">
        <nav aria-label="Breadcrumb" className="mb-2 text-sm text-gray-400">
          <a href="/attendance/overtime" className="hover:text-[#0B2545]">
            Overtime Requests
          </a>
          {' / '}
          <span className="text-[#0B2545]">New Request</span>
        </nav>
        <h1 className="text-2xl font-bold text-[#0B2545]">New Overtime Request</h1>
        <p className="mt-1 text-sm text-gray-500">
          Submit an overtime authorization request for supervisor approval.
        </p>
      </div>

      <div className="rounded-xl border border-[#0B2545]/10 bg-white p-6 shadow-sm">
        <OvertimeForm
          employeeId={user.id}
          supervisors={supervisors}
        />
      </div>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        Overtime requests must be submitted before the overtime is rendered.
        Post-facto requests require additional documentation per Senate HR Policy.
      </div>
    </main>
  );
}
