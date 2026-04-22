/**
 * /saln/tracking — SALN Compliance Tracking Dashboard
 *
 * Displays KPI cards, a compliance progress bar, per-office fill rate bars,
 * an upcoming deadline countdown, and a non-filer table with individual and
 * bulk "Send Reminder" controls.
 *
 * Access: any role with saln.view permission (super_admin, hr_admin, auditor).
 * Write actions (Send Reminder, Export) are shown only for super_admin / hr_admin.
 *
 * Realtime: RealtimeBoundary on ['saln_submissions'] refreshes the
 * page whenever a new submission lands.
 */

import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import {
  getSalnComplianceForYear,
  getSalnNonFilers,
} from "@/app/(dashboard)/saln/queries";
import { sendReminders } from "@/app/(dashboard)/saln/actions";
import { exportDocuments } from "@/app/(dashboard)/saln/admin-actions";
import { PageHeader } from "@/components/layouts/page-header";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import {
  currentCoverageYear,
  daysUntilDeadline,
  deadlineLabel,
} from "@/lib/utils/saln/deadline";
import { TrackingClient } from "./_client";

// ---------------------------------------------------------------------------
// Helpers — computed on the server so the client stays thin
// ---------------------------------------------------------------------------

interface OfficeStats {
  officeName: string;
  total: number;
  filed: number;
  fillRate: number;
}

function buildOfficeStats(
  rows: Awaited<ReturnType<typeof getSalnComplianceForYear>>,
): OfficeStats[] {
  const map = new Map<string, { total: number; filed: number }>();

  for (const row of rows) {
    const key = row.officeName ?? "Unassigned";
    const entry = map.get(key) ?? { total: 0, filed: 0 };
    entry.total += 1;
    if (row.hasFiled) entry.filed += 1;
    map.set(key, entry);
  }

  return Array.from(map.entries())
    .map(([officeName, { total, filed }]) => ({
      officeName,
      total,
      filed,
      fillRate: total > 0 ? Math.round((filed / total) * 100) : 0,
    }))
    .sort((a, b) => b.fillRate - a.fillRate);
}

// ---------------------------------------------------------------------------
// Page props
// ---------------------------------------------------------------------------

interface TrackingPageProps {
  searchParams: Promise<{ year?: string }>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SalnTrackingPage({
  searchParams,
}: TrackingPageProps) {
  // Auth: require saln/view permission (super_admin, hr_admin, auditor)
  const user = await requirePermission("saln", "view");

  const canWrite = user.role === "super_admin" || user.role === "hr_admin";

  const resolved = await searchParams;
  const year = resolved.year
    ? parseInt(resolved.year, 10)
    : currentCoverageYear();

  // Parallel data fetches
  const [allRows, nonFilers] = await Promise.all([
    getSalnComplianceForYear(year),
    getSalnNonFilers(year),
  ]);

  // KPI derivations (server-side)
  const totalEmployees = allRows.length;
  const totalFiled = allRows.filter((r) => r.hasFiled && !r.isLate).length;
  const totalFiledLate = allRows.filter((r) => r.isLate).length;
  const totalNotFiled = allRows.filter((r) => !r.hasFiled).length;
  const complianceRate =
    totalEmployees > 0
      ? Math.round(((totalFiled + totalFiledLate) / totalEmployees) * 100)
      : 0;

  const officeStats = buildOfficeStats(allRows);

  // Deadline info
  const daysLeft = daysUntilDeadline(year);
  const deadlineDateLabel = deadlineLabel(year);

  // Year selector: current year + last 4
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Inline server actions forwarded to client (write actions — guarded)
  async function handleSendReminders(
    employeeIds: string[],
  ): Promise<{ sent: number; failed: number }> {
    "use server";
    await requirePermission("saln", "approve");
    const result = await sendReminders({
      year,
      employeeIds: employeeIds.length > 0 ? employeeIds : undefined,
    });
    return { sent: result.sent, failed: result.failed };
  }

  async function handleExportCsv(): Promise<{
    content: string;
    filename: string;
    mimeType: string;
  }> {
    "use server";
    await requirePermission("saln", "approve");
    return exportDocuments({ year, format: "csv" });
  }

  return (
    <div className="space-y-6">
      <RealtimeBoundary tables={["saln_submissions"]} />

      <PageHeader
        title="SALN Compliance Tracking"
        description={`Annual SALN filing compliance overview for Calendar Year ${year}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "SALN", href: "/saln/submissions" },
          { label: "Compliance Tracking" },
        ]}
        actions={
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">Year:</span>
            <div className="flex gap-1">
              {yearOptions.map((y) => (
                <Link
                  key={y}
                  href={`/saln/tracking?year=${y}`}
                  className={`rounded px-2.5 py-1 text-sm font-medium transition-colors ${
                    y === year
                      ? "bg-pcso-navy text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {y}
                </Link>
              ))}
            </div>
          </div>
        }
      />

      <TrackingClient
        year={year}
        totalEmployees={totalEmployees}
        totalFiled={totalFiled}
        totalFiledLate={totalFiledLate}
        totalNotFiled={totalNotFiled}
        complianceRate={complianceRate}
        officeStats={officeStats}
        daysLeft={daysLeft}
        deadlineDateLabel={deadlineDateLabel}
        nonFilers={nonFilers}
        canWrite={canWrite}
        onSendReminders={handleSendReminders}
        onExportCsv={handleExportCsv}
      />
    </div>
  );
}
