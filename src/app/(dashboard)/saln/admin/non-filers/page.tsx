/**
 * /saln/admin/non-filers — SALN Non-Filers List
 *
 * Focused view of employees who have not yet filed their annual SALN.
 * Supports bulk reminder sending for authorized roles.
 *
 * Access: any role with saln.view permission (super_admin, hr_admin, auditor).
 * Write actions (Send All Reminders) shown only for super_admin / hr_admin.
 */

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { getSalnNonFilers } from "@/app/(dashboard)/saln/queries";
import { sendReminders } from "@/app/(dashboard)/saln/actions";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deadlineLabel, currentCoverageYear } from "@/lib/utils/saln/deadline";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { SendAllRemindersButton } from "./_client";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface NonFilersPageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function SalnNonFilersPage({
  searchParams,
}: NonFilersPageProps) {
  const user = await requirePermission("saln", "view");

  const canWrite = user.role === "super_admin" || user.role === "hr_admin";

  const resolvedParams = await searchParams;
  const year = resolvedParams.year
    ? parseInt(resolvedParams.year, 10)
    : currentCoverageYear();

  const nonFilers = await getSalnNonFilers(year);
  const deadline = deadlineLabel(year);

  async function handleSendAllReminders(): Promise<{
    sent: number;
    failed: number;
    skipped?: number;
  }> {
    "use server";
    await requirePermission("saln", "approve");
    const result = await sendReminders({ year });
    return {
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
    };
  }

  return (
    <div>
      <RealtimeBoundary tables={["saln_submissions"]} />
      <PageHeader
        title="SALN Non-Filers"
        description={`Employees who have not filed their Annual SALN for ${year} (Deadline: ${deadline})`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "SALN Admin", href: "/saln/admin" },
          { label: "Non-Filers" },
        ]}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/saln/admin">
              <ArrowLeftIcon className="mr-1.5 h-4 w-4" aria-hidden />
              Back to Compliance Tracker
            </Link>
          </Button>
        }
      />

      {/* Summary */}
      <div className="mb-6 flex items-center gap-4 rounded-md border border-destructive/30 bg-destructive/5 p-4">
        <div>
          <p className="text-sm font-semibold text-destructive">
            {nonFilers.length} employee{nonFilers.length !== 1 ? "s" : ""} have
            not filed
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Annual SALN for Calendar Year {year} · Deadline: {deadline}
          </p>
        </div>

        {canWrite && nonFilers.length > 0 && (
          <div className="ml-auto">
            <SendAllRemindersButton
              sendAll={handleSendAllReminders}
              nonFilerCount={nonFilers.length}
            />
          </div>
        )}
      </div>

      {nonFilers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-green-300 bg-green-50 py-16 text-center">
          <p className="text-sm font-medium text-green-800">
            All employees have filed their SALN for {year}.
          </p>
          <p className="mt-1 text-xs text-green-600">Compliance rate: 100%</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Office</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nonFilers.map((row) => (
                <TableRow key={row.employeeId}>
                  <TableCell className="font-mono text-sm">
                    {row.employeeNo}
                  </TableCell>
                  <TableCell className="font-medium">
                    {row.employeeName}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.positionTitle}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.officeName ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Non-filing is a violation of Section 8 of Republic Act No. 6713. This
        list should be submitted to the Civil Service Commission (CSC) and
        Commission on Audit (COA) as required.
      </p>
    </div>
  );
}
