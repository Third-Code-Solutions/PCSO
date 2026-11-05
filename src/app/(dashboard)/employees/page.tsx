import { Suspense } from "react";
import Link from "next/link";
import { UserPlus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeFilters } from "@/components/employees/employee-filters";
import { EmployeeListTable } from "@/components/employees/employee-list-table";
import { EmployeeListSkeleton } from "@/components/employees/employee-list-skeleton";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { requireAuth } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { RoleGate } from "@/components/role-gate";
import { getEmployees, getOfficesForSelect } from "./queries";
import {
  EmployeeListParamsSchema,
  type EmployeeListParams,
} from "@/lib/validations/employees";
import type { Role } from "@/lib/auth/permissions";

// Export CSV is available to roles that can export employee data.
const EXPORT_ROLES: ReadonlyArray<Role> = ["super_admin", "hr_admin"];

async function EmployeesDataSection({
  params,
}: {
  params: EmployeeListParams;
}) {
  const [listResult, offices] = await Promise.all([
    getEmployees(params),
    getOfficesForSelect(),
  ]);

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {listResult.total.toLocaleString()} record
        {listResult.total !== 1 ? "s" : ""} found
      </p>
      <EmployeeFilters offices={offices} />
      <EmployeeListTable
        initialData={listResult}
        currentPage={params.page}
        perPage={params.perPage}
      />
    </>
  );
}

export const metadata = {
  title: "Employees",
  description: "View and manage all employee records.",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[]>>;
}

export default async function EmployeesPage({ searchParams }: PageProps) {
  // Two-layer auth enforcement per CLAUDE.md:
  //   Layer 1: middleware ROUTE_ACCESS blocks employee_self_service at the edge.
  //   Layer 2: server-component guard — ESS may only view their own profile,
  //            not the full employee list. Redirect them to /profile.
  const user = await requireAuth();
  if (user.role === "employee_self_service") {
    redirect("/profile");
  }
  const rawParams = await searchParams;

  // Flatten string arrays to first value for each key
  const flatParams = Object.fromEntries(
    Object.entries(rawParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );

  const params = EmployeeListParamsSchema.parse(flatParams);

  // Unit-scoped roles (supervisor / leave_approver) are restricted to their
  // own office. Inject the user's officeId as the default filter unless the
  // URL already carries an explicit officeId (supervisors can still drill into
  // their own unit sub-views if the filter UI passes one, but the server will
  // enforce the scope gate below).
  const isUnitScoped =
    (user.role === "supervisor" || user.role === "leave_approver") &&
    user.officeId !== null;

  // For unit-scoped roles, always enforce the user's own office — ignore any
  // officeId the URL may carry to prevent scope-override attempts.
  // The `isUnitScoped` guard above already ensures user.officeId is non-null
  // when true; the non-null assertion makes that explicit to TypeScript.
  const effectiveOfficeId: string | undefined = isUnitScoped
    ? (user.officeId as string)
    : (params.officeId ?? undefined);

  const scopedParams = { ...params, officeId: effectiveOfficeId };

  // Build export QS from validated filter params only — avoids leaking
  // unknown keys and keeps the server-side CSV query identical to what the
  // user sees on-screen.
  const exportParams = new URLSearchParams();
  if (scopedParams.search) exportParams.set("search", scopedParams.search);
  if (scopedParams.appointmentType)
    exportParams.set("appointmentType", scopedParams.appointmentType);
  if (scopedParams.officeId)
    exportParams.set("officeId", scopedParams.officeId);
  if (scopedParams.status) exportParams.set("status", scopedParams.status);
  if (scopedParams.salaryGrade)
    exportParams.set("salaryGrade", String(scopedParams.salaryGrade));
  const exportQS = exportParams.toString();

  return (
    <div className="space-y-6 p-6">
      {/* Realtime subscription — refreshes on any employees table change */}
      <RealtimeBoundary tables={["employees"]} />

      {/* Page header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-pcso-navy">
            Employees
            {isUnitScoped && (
              <span className="ml-2 text-base font-normal text-muted-foreground">
                — Your Unit
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <RoleGate role={user.role} roles={EXPORT_ROLES} fallback={null}>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a
                href={
                  exportQS
                    ? `/api/employees/export?${exportQS}`
                    : "/api/employees/export"
                }
                download
              >
                <Download className="h-4 w-4" />
                Export CSV
              </a>
            </Button>
          </RoleGate>
          {/* Add Employee — restricted to roles that can access /employees/new.
              Uses pathname-based gate so this stays in sync with ROUTE_ACCESS
              in permissions.ts without a separate hardcoded role list. */}
          <RoleGate role={user.role} pathname="/employees/new" fallback={null}>
            <Button
              asChild
              size="sm"
              className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
            >
              <Link href="/employees/new">
                <UserPlus className="h-4 w-4" />
                Add Employee
              </Link>
            </Button>
          </RoleGate>
        </div>
      </header>

      <Suspense
        fallback={<EmployeeListSkeleton rows={Math.min(params.perPage, 10)} />}
      >
        <EmployeesDataSection params={scopedParams} />
      </Suspense>
    </div>
  );
}
