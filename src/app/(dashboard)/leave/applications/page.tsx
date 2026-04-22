/**
 * /leave/applications — Unified leave applications browser
 *
 * Tabs (via ?tab= query param):
 *  - "mine"    : My Applications — available to everyone
 *  - "pending" : Pending Approval queue — leave_approver, hr_admin, super_admin
 *  - "all"     : Full filterable history — hr_admin, super_admin
 *
 * Additional URL params (all tabs):
 *  - ?page=N             (server-side pagination, 1-indexed)
 *  - ?pageSize=10|25|50|100   (defaults to 50; max 200)
 *  - ?status=<status>    (all tab only)
 *  - ?leaveType=<code>   (all tab only; client-side filter within page)
 *  - ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD  (all tab only; server-filtered)
 *  - ?q=<text>           (client-side fuzzy filter on employee name/no/reason)
 *
 * Data is fetched server-side; the tab switcher uses URL state for routing.
 * A RealtimeBoundary subscribes to leave_applications for live updates.
 */

import { Suspense } from "react";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layouts/page-header";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import {
  getMyLeaveApplications,
  getAllLeaveApplicationsPaged,
} from "@/app/(dashboard)/leave/queries";
import { approveLeave, disapproveLeave } from "@/app/(dashboard)/leave/actions";
import {
  TabSwitcher,
  MyApplicationsTable,
  PendingApprovalTable,
  AllApplicationsTable,
  FilterToolbar,
  Pagination,
  TableSkeleton,
} from "./_client";
import type { TabKey, AllFilters } from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leave Applications",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZES = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 50;

function pickString(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && v.length > 0 ? v : undefined;
}

function resolveTab(
  raw: string | undefined,
  canPending: boolean,
  canAll: boolean,
): TabKey {
  if (raw === "pending" && canPending) return "pending";
  if (raw === "all" && canAll) return "all";
  return "mine";
}

function clampPageSize(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return DEFAULT_PAGE_SIZE;
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LeaveApplicationsPage({
  searchParams,
}: PageProps) {
  // Role gating — everyone with `leave.view` lands here; the matrix
  // grants `employee_self_service` view access with a self-only constraint,
  // so the "Mine" tab is the default landing for them and the Pending /
  // All tabs are hidden unless the role is allowed to see them.
  const user = await requirePermission("leave", "view");

  const canPending = hasPermission(user.role, "leave", "approve");
  // `canAll` grants access to the full filterable history tab.
  // Auditors/viewers have leave.view but not leave.export — they should still
  // be able to see all applications read-only.  Export capability is checked
  // separately inside the AllApplicationsTable client component.
  const canAll =
    hasPermission(user.role, "leave", "export") ||
    (hasPermission(user.role, "leave", "view") &&
      user.role !== "employee_self_service");

  const params = await searchParams;
  const rawTab = pickString(params["tab"]);
  const rawStatus = pickString(params["status"]);
  const rawLeaveType = pickString(params["leaveType"]);
  const rawDateFrom = pickString(params["dateFrom"]);
  const rawDateTo = pickString(params["dateTo"]);
  const rawQuery = pickString(params["q"]);
  const rawPage = pickString(params["page"]);
  const rawPageSize = pickString(params["pageSize"]);

  const activeTab = resolveTab(rawTab, canPending, canAll);
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const pageSize = clampPageSize(rawPageSize);

  // ---------------------------------------------------------------------------
  // Data fetching — only fetch what the active tab needs.
  // ---------------------------------------------------------------------------

  const [myApplications, pendingPaged, allPaged] = await Promise.all([
    activeTab === "mine" && user.employeeId
      ? getMyLeaveApplications(user.employeeId)
      : Promise.resolve(null),
    activeTab === "pending" && canPending
      ? getAllLeaveApplicationsPaged({ status: "pending", page, pageSize })
      : Promise.resolve(null),
    activeTab === "all" && canAll
      ? getAllLeaveApplicationsPaged({
          status: rawStatus,
          dateFrom: rawDateFrom,
          dateTo: rawDateTo,
          page,
          pageSize,
        })
      : Promise.resolve(null),
  ]);

  const pendingEnriched = pendingPaged?.rows ?? null;
  const allApplications = allPaged?.rows ?? null;
  const activePager =
    activeTab === "pending"
      ? pendingPaged
      : activeTab === "all"
        ? allPaged
        : null;

  // Build current-filters object for client components + URL round-tripping.
  const currentFilters: AllFilters = {
    status: rawStatus,
    leaveType: rawLeaveType,
    dateFrom: rawDateFrom,
    dateTo: rawDateTo,
    q: rawQuery,
  };

  // ---------------------------------------------------------------------------
  // Inline server actions (wrapped so the page can pass them as props)
  // ---------------------------------------------------------------------------

  async function handleApprove(id: string, remarks?: string) {
    "use server";
    await approveLeave({ leaveApplicationId: id, remarks });
  }

  async function handleDisapprove(id: string, remarks: string) {
    "use server";
    await disapproveLeave({ leaveApplicationId: id, remarks });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <RealtimeBoundary tables={["leave_applications"]} />

      <PageHeader
        title="Leave Applications"
        description="Track, review, and manage all leave applications."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leave", href: "/leave" },
          { label: "Applications" },
        ]}
        actions={
          <Button
            size="sm"
            asChild
            className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
          >
            <Link href="/leave/apply">
              <PlusIcon className="mr-1.5 h-4 w-4" />
              Apply for Leave
            </Link>
          </Button>
        }
      />

      <div className="mt-6 space-y-5">
        <TabSwitcher
          activeTab={activeTab}
          showPending={canPending}
          showAll={canAll}
        />

        <Suspense fallback={<TableSkeleton />}>
          {activeTab === "mine" && (
            <MyApplicationsTable applications={myApplications ?? []} />
          )}

          {activeTab === "pending" && canPending && (
            <>
              <FilterToolbar
                activeTab="pending"
                filters={currentFilters}
                pageSize={pageSize}
                pageSizes={PAGE_SIZES as readonly number[]}
              />
              <PendingApprovalTable
                applications={pendingEnriched ?? []}
                filters={currentFilters}
                onApprove={handleApprove}
                onDisapprove={handleDisapprove}
              />
            </>
          )}

          {activeTab === "all" && canAll && (
            <>
              <FilterToolbar
                activeTab="all"
                filters={currentFilters}
                pageSize={pageSize}
                pageSizes={PAGE_SIZES as readonly number[]}
              />
              <AllApplicationsTable
                applications={allApplications ?? []}
                filters={currentFilters}
              />
            </>
          )}
        </Suspense>

        {activePager && (
          <Pagination
            activeTab={activeTab}
            filters={currentFilters}
            pageSize={pageSize}
            page={activePager.page}
            totalPages={activePager.totalPages}
            total={activePager.total}
          />
        )}
      </div>
    </main>
  );
}
