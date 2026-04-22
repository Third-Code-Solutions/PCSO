/**
 * /saln/submissions — SALN Submissions Browser
 *
 * User-facing submissions browser for SALN data under RA 6713 / EO 17.
 *
 * Access rules:
 *   - employee_self_service: sees only their own submissions (grouped by year).
 *   - super_admin: sees all submissions; can filter by employee_no, status, year.
 *   - All other roles: redirected to /dashboard?error=forbidden.
 *
 * View-audit: every access to a non-draft submission list is logged.
 * RealtimeBoundary refreshes the page on changes to saln_submissions.
 *
 * Pagination: super_admin view is server-paginated (50 rows / page).
 * Employee self-service typically returns <10 rows/user so client-side grouping suffices.
 */

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import {
  getMySalnSubmissions,
  getAllSubmissionsForSuperAdmin,
  SUBMISSIONS_PAGE_SIZE,
} from "@/app/(dashboard)/saln/queries";
import { PageHeader } from "@/components/layouts/page-header";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { SubmissionsBrowser } from "./_client";
import type { SalnStatus } from "@/lib/validations/saln";

// ---------------------------------------------------------------------------
// Page props
// ---------------------------------------------------------------------------

interface SubmissionsPageProps {
  searchParams: Promise<{
    status?: string;
    employee_no?: string;
    year?: string;
    page?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SalnSubmissionsPage({
  searchParams,
}: SubmissionsPageProps) {
  // Gate: super_admin, hr_admin, auditor (viewer) may view all SALN submissions.
  // employee_self_service sees only their own records.
  // requirePermission redirects any role without saln.view to /login?unauthorized.
  const user = await requirePermission("saln", "view");

  // "admin view" = full paginated list of all submissions.
  // Super admin, hr_admin, and auditor/viewer roles all get the admin view.
  const isAdminView =
    user.role === "super_admin" ||
    user.role === "hr_admin" ||
    user.role === "auditor" ||
    user.role === "viewer";

  // Keep legacy isSuperAdmin flag for write-action gating (only super_admin can
  // change statuses from within this page).
  const isSuperAdmin = user.role === "super_admin";

  // Self-service employees must have an employeeId to view their own SALN.
  if (!isAdminView && !user.employeeId) {
    redirect("/dashboard");
  }

  const resolvedParams = await searchParams;

  // Validate status filter against the known enum values.
  const VALID_STATUSES: SalnStatus[] = [
    "draft",
    "submitted",
    "received",
    "verified",
    "deficient",
  ];
  const rawStatus = resolvedParams.status;
  const statusFilter =
    rawStatus && (VALID_STATUSES as string[]).includes(rawStatus)
      ? (rawStatus as SalnStatus)
      : undefined;

  const employeeNoFilter = isAdminView
    ? (resolvedParams.employee_no ?? undefined)
    : undefined;

  // Year filter — only meaningful for admin roles.
  const yearFilter = (() => {
    if (!isAdminView || !resolvedParams.year) return undefined;
    const parsed = parseInt(resolvedParams.year, 10);
    if (Number.isNaN(parsed) || parsed < 2000 || parsed > 2100)
      return undefined;
    return parsed;
  })();

  // Page number.
  const pageNum = (() => {
    if (!resolvedParams.page) return 1;
    const parsed = parseInt(resolvedParams.page, 10);
    return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
  })();

  // Fetch submissions — self-only for employees, paginated for admin roles.
  let submissions: Awaited<ReturnType<typeof getMySalnSubmissions>>;
  let total = 0;
  let perPage = SUBMISSIONS_PAGE_SIZE;

  if (isAdminView) {
    const result = await getAllSubmissionsForSuperAdmin(user.id, {
      status: statusFilter,
      employeeNo: employeeNoFilter,
      year: yearFilter,
      page: pageNum,
      perPage,
    });
    submissions = result.rows;
    total = result.total;
    perPage = result.perPage;
  } else {
    submissions = await getMySalnSubmissions(
      user.id,
      user.employeeId as string,
    );
    total = submissions.length;
  }

  // For employee_self_service apply status filter in-page (query is already self-scoped).
  const filtered =
    !isAdminView && statusFilter
      ? submissions.filter((s) => s.status === statusFilter)
      : submissions;

  return (
    <div>
      <RealtimeBoundary tables={["saln_submissions"]} />

      <PageHeader
        title={isAdminView ? "SALN Submissions" : "My SALN Submissions"}
        description="Statement of Assets, Liabilities, and Net Worth — RA 6713 / EO 17"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "SALN", href: "/saln" },
          { label: "Submissions" },
        ]}
        actions={
          <Button
            asChild
            className="bg-pcso-navy text-white hover:bg-pcso-navy-light"
          >
            <Link href="/saln/new">
              <PlusIcon className="mr-2 h-4 w-4" aria-hidden />
              New Submission
            </Link>
          </Button>
        }
      />

      <SubmissionsBrowser
        submissions={filtered}
        isSuperAdmin={isAdminView}
        activeStatus={statusFilter}
        activeEmployeeNo={employeeNoFilter ?? ""}
        activeYear={yearFilter}
        page={pageNum}
        perPage={perPage}
        total={total}
      />

      <p className="mt-4 text-xs text-muted-foreground">
        SALN data is strictly confidential under Republic Act No. 6713. All
        access is logged and audited.
      </p>
    </div>
  );
}
