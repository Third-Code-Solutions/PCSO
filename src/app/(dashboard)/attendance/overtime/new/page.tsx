import { requireAuth } from "@/lib/auth/guards";
import { getEmployeeSummaries } from "../../queries";
import { NewOvertimeRequestForm } from "./_client";

export const metadata = { title: "New Overtime Request" };

export default async function NewOvertimePage() {
  const user = await requireAuth();

  if (!user.employeeId) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12 text-center text-sm text-gray-500">
        Your account is not linked to an employee record. Contact HR to file
        overtime.
      </main>
    );
  }

  const employees = await getEmployeeSummaries().catch(() => []);

  // Supervisors: every other employee (employee picks their approver)
  const supervisors = employees
    .filter((e) => e.id !== user.employeeId)
    .map((e) => ({ id: e.id, name: `${e.lastName}, ${e.firstName}` }));

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6">
        <nav aria-label="Breadcrumb" className="mb-2 text-sm text-gray-400">
          <a href="/attendance/overtime" className="hover:text-[#0B2545]">
            Overtime Requests
          </a>
          {" / "}
          <span className="text-[#0B2545]">New Request</span>
        </nav>
        <h1 className="text-2xl font-bold text-[#0B2545]">
          New Overtime Request
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Submit an overtime authorization request for supervisor approval.
        </p>
      </div>

      <div className="rounded-xl border border-[#0B2545]/10 bg-white p-6 shadow-sm">
        <NewOvertimeRequestForm
          employeeId={user.employeeId}
          supervisors={supervisors}
        />
      </div>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        Overtime requests must be submitted before the overtime is rendered.
        Post-facto requests require additional documentation per PCSO HR Policy.
      </div>
    </main>
  );
}
