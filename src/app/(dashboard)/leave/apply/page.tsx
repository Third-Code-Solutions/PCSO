/**
 * /leave/apply — Employee leave application page
 *
 * Flow:
 *   1. Server-rendered shell with Suspense skeleton.
 *   2. Inner server component fetches employee profile + credit balance,
 *      computes eligibility, and passes everything to the client form.
 *   3. Client form calls `applyLeave` server action, toasts success,
 *      and redirects back to /leave after a short delay.
 *
 * Role gate: only employee_self_service, hr_admin, super_admin may apply.
 */

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { LeaveApplyForm } from "@/components/leave/leave-apply-form";
import { getEligibleLeaveTypes } from "@/lib/utils/leave/eligibility";
import { getLeaveCreditBalance } from "@/app/(dashboard)/leave/queries";
import { applyLeave } from "@/app/(dashboard)/leave/actions";
import type { Gender, CivilStatus } from "@/lib/utils/leave/eligibility";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircleIcon, ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apply for Leave",
};

// Routes that can apply for leave themselves.
const APPLY_ROLES = new Set([
  "employee_self_service",
  "hr_admin",
  "super_admin",
]);

type AppointmentType =
  | "permanent"
  | "temporary"
  | "casual"
  | "coterminous"
  | "job_order"
  | "contract_of_service";

export default async function ApplyLeavePage() {
  // `view` is the minimum permission to see the apply shell; the server
  // action enforces `create` on submit. Keeps the page open to approvers
  // (who may need to refer people to it) without bypassing any write guard.
  const user = await requirePermission("leave", "view");

  // Role gate — approvers/auditors without employeeId still fall through to
  // the "no employee record" empty state below. Redirect out of /leave/apply
  // entirely if the role simply can't apply.
  if (!APPLY_ROLES.has(user.role)) {
    redirect("/leave");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <RealtimeBoundary tables={["leave_applications", "leave_credits"]} />

      <PageHeader
        title="Apply for Leave"
        description="File a leave application. Credits will be checked in real time."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leave", href: "/leave" },
          { label: "Apply" },
        ]}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/leave">
              <ArrowLeftIcon className="mr-1.5 h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      {!user.employeeId ? (
        <EmptyState
          title="No employee record linked"
          message="Your account isn't linked to an employee record yet. Please contact HR to resolve this before filing a leave application."
        />
      ) : (
        <Suspense fallback={<ApplyFormSkeleton />}>
          <ApplyFormLoader employeeId={user.employeeId} />
        </Suspense>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Inner: fetches everything the form needs, then renders it
// ---------------------------------------------------------------------------

async function ApplyFormLoader({ employeeId }: { employeeId: string }) {
  // Use the admin client so this fetch succeeds regardless of whether the
  // user's JWT already reflects the updated app_metadata (employee_id claim).
  // Security: employeeId was already validated by requirePermission + the
  // system_users lookup in getCurrentUser — we are not bypassing auth here.
  const [{ data: emp, error: empError }, creditBalance] = await Promise.all([
    supabaseAdmin
      .from("employees")
      .select("gender, civil_status, appointment_type, date_hired, status")
      .eq("id", employeeId)
      .single(),
    getLeaveCreditBalance(employeeId, new Date().getFullYear()),
  ]);

  if (empError || !emp) {
    return (
      <EmptyState
        title="Employee record not found"
        message="We couldn't load your employee record. Please contact HR."
      />
    );
  }

  const appointmentType =
    (emp.appointment_type as AppointmentType) ?? "permanent";

  // Job-order / contract-of-service personnel aren't entitled to CSC leaves
  // under IRR §47. Guard at the page so we don't render a broken form.
  if (
    appointmentType === "job_order" ||
    appointmentType === "contract_of_service"
  ) {
    return (
      <EmptyState
        title="Not eligible to file a leave application"
        message="Your appointment type is not entitled to CSC leave credits. If you believe this is an error, please contact HR."
      />
    );
  }

  const hireDate = emp.date_hired
    ? new Date(String(emp.date_hired))
    : new Date();
  const yearsInService =
    (Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  const eligibleLeaveTypes = getEligibleLeaveTypes({
    gender: (emp.gender as Gender) ?? "male",
    civilStatus: (emp.civil_status as CivilStatus) ?? "single",
    yearsInService,
    appointmentType,
  });

  if (eligibleLeaveTypes.length === 0) {
    return (
      <EmptyState
        title="No eligible leave types"
        message="Based on your profile (years in service, appointment type, etc.), there are currently no leave types you can file for. Please contact HR."
      />
    );
  }

  const currentYear = new Date().getFullYear();

  return (
    <LeaveApplyForm
      employeeId={employeeId}
      eligibleLeaveTypes={eligibleLeaveTypes}
      vlBalance={creditBalance?.vlBalance ?? 0}
      slBalance={creditBalance?.slBalance ?? 0}
      year={currentYear}
      onSubmit={applyLeave}
    />
  );
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/10 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <AlertCircleIcon className="h-6 w-6" />
      </div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" asChild className="mt-2">
        <Link href="/leave">Back to Leave</Link>
      </Button>
    </div>
  );
}

function ApplyFormSkeleton() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <aside className="order-last lg:order-first lg:col-span-1">
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      </aside>
      <div className="order-first space-y-5 lg:order-last lg:col-span-2">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
    </div>
  );
}
