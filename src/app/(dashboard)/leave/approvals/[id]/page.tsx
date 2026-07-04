/**
 * /leave/approvals/[id] — Leave application detail + approve/disapprove actions
 */

import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLeaveApplicationDetail } from "@/app/(dashboard)/leave/queries";
import { approveLeave, disapproveLeave } from "@/app/(dashboard)/leave/actions";
import { LEAVE_TYPES } from "@/lib/constants/leave-types";
import type { LeaveTypeCode } from "@/lib/constants/leave-types";
import {
  CalendarIcon,
  UserIcon,
  FileTextIcon,
  AlertCircleIcon,
} from "lucide-react";
import { MULTI_LEVEL_APPROVAL_THRESHOLD_DAYS } from "@/lib/constants/leave-types";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leave Application Detail",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Derive a human-friendly file name from a signed storage URL or raw path.
 * Upload paths look like leave-attachments/{employeeId}/{ts}_{i}_{name}.
 */
function attachmentLabel(pathOrUrl: string): string {
  try {
    const pathname = new URL(pathOrUrl, "https://storage.local").pathname;
    const baseName = decodeURIComponent(pathname.split("/").pop() ?? "");
    if (!baseName) return pathOrUrl;
    return baseName.replace(/^\d+_\d+_/, "").replace(/^\d+_/, "");
  } catch {
    return pathOrUrl;
  }
}

export default async function LeaveApprovalDetailPage({ params }: PageProps) {
  await requirePermission("leave", "approve");

  const { id } = await params;
  const application = await getLeaveApplicationDetail(id);

  if (!application) notFound();

  const leaveType = LEAVE_TYPES[application.leaveTypeCode as LeaveTypeCode];
  const isMultiLevel =
    application.workingDays > MULTI_LEVEL_APPROVAL_THRESHOLD_DAYS;
  const isPending = application.status === "pending";

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <RealtimeBoundary tables={["leave_applications"]} />
      <PageHeader
        title="Leave Application"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leave", href: "/leave" },
          { label: "Approvals", href: "/leave/approvals" },
          { label: `#${id.slice(0, 8).toUpperCase()}` },
        ]}
      />

      <div className="space-y-5">
        {/* Status banner */}
        <div className="flex items-center justify-between rounded-xl border bg-card p-5 shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Application Status
            </p>
            <Badge
              variant={
                application.status === "approved"
                  ? "success"
                  : application.status === "disapproved" ||
                      application.status === "cancelled"
                    ? "destructive"
                    : "warning"
              }
              className="text-sm px-3 py-1"
            >
              {application.status.replace(/_/g, " ").toUpperCase()}
            </Badge>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Filed</p>
            <p className="text-sm font-medium">
              {new Date(application.createdAt).toLocaleDateString("en-PH", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Multi-level notice */}
        {isMultiLevel && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This application exceeds {MULTI_LEVEL_APPROVAL_THRESHOLD_DAYS}{" "}
              working days and requires multi-level approval.
            </p>
          </div>
        )}

        {/* Employee Info */}
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b bg-muted/30 px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <UserIcon className="h-4 w-4" /> Employee
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 p-5">
            <div>
              <p className="text-xs text-muted-foreground">Full Name</p>
              <p className="mt-1 text-sm font-medium">
                {application.employee.lastName},{" "}
                {application.employee.firstName}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Employee No.</p>
              <p className="mt-1 text-sm font-medium font-mono">
                {application.employee.employeeNo}
              </p>
            </div>
          </div>
        </section>

        {/* Leave Details */}
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b bg-muted/30 px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarIcon className="h-4 w-4" /> Leave Details
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Leave Type</p>
              <p className="mt-1 text-sm font-medium">
                {leaveType?.name ?? application.leaveTypeCode}
              </p>
              {leaveType && !leaveType.withPay && (
                <Badge variant="muted" className="mt-1 text-xs">
                  Without Pay
                </Badge>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date From</p>
              <p className="mt-1 text-sm font-medium">
                {formatDate(application.startDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date To</p>
              <p className="mt-1 text-sm font-medium">
                {formatDate(application.endDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Working Days</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-pcso-navy">
                {application.workingDays}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Period</p>
              <p className="mt-1 text-sm font-medium capitalize">
                {application.period === "whole_day"
                  ? "Whole Day"
                  : application.period === "am"
                    ? "Morning (AM)"
                    : "Afternoon (PM)"}
              </p>
            </div>
          </div>
          {application.reason && (
            <div className="border-t px-5 py-4">
              <p className="text-xs text-muted-foreground">Reason / Purpose</p>
              <p className="mt-1 text-sm italic text-foreground/80">
                &ldquo;{application.reason}&rdquo;
              </p>
            </div>
          )}
        </section>

        {/* Supporting Documents */}
        {application.attachmentPaths &&
          application.attachmentPaths.length > 0 && (
            <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="border-b bg-muted/30 px-5 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <FileTextIcon className="h-4 w-4" /> Supporting Documents
                </h2>
              </div>
              <ul className="divide-y">
                {application.attachmentPaths.map((path, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <span className="truncate text-sm text-muted-foreground">
                      {attachmentLabel(path)}
                    </span>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={path} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

        {/* Approval Actions */}
        {isPending && (
          <section className="overflow-hidden rounded-xl border border-pcso-navy/20 bg-card shadow-sm">
            <div className="border-b bg-pcso-navy/5 px-5 py-3">
              <h2 className="text-sm font-semibold text-pcso-navy">
                Your Decision
              </h2>
            </div>
            <div className="p-5 space-y-4">
              {/* Disapprove form — includes remarks field; remarks required (min 5 chars) */}
              <form
                action={async (formData: FormData) => {
                  "use server";
                  const remarks =
                    (formData.get("disapprove_remarks") as string | null) ?? "";
                  await disapproveLeave({ leaveApplicationId: id, remarks });
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label
                    htmlFor="disapprove_remarks"
                    className="block text-sm font-medium"
                  >
                    Reason for Disapproval{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    id="disapprove_remarks"
                    name="disapprove_remarks"
                    rows={3}
                    required
                    minLength={5}
                    className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pcso-navy"
                    placeholder="Required — provide a reason for disapproval..."
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="outline"
                    className="border-destructive/30 text-destructive hover:bg-destructive/5"
                  >
                    Disapprove
                  </Button>
                </div>
              </form>

              {/* Approve form — remarks are optional */}
              <form
                action={async (formData: FormData) => {
                  "use server";
                  const remarks =
                    (formData.get("approve_remarks") as string | null) ??
                    undefined;
                  await approveLeave({
                    leaveApplicationId: id,
                    remarks: remarks || undefined,
                  });
                }}
                className="space-y-4 border-t pt-4"
              >
                <div className="space-y-1.5">
                  <label
                    htmlFor="approve_remarks"
                    className="block text-sm font-medium"
                  >
                    Approver Remarks{" "}
                    <span className="text-muted-foreground text-xs">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="approve_remarks"
                    name="approve_remarks"
                    rows={2}
                    className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pcso-navy"
                    placeholder="Add remarks (optional)..."
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="bg-emerald-700 hover:bg-emerald-800 text-white"
                  >
                    Approve Application
                  </Button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* Approver Remarks (read-only after decision) */}
        {application.approverRemarks && !isPending && (
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-2">
              Approver Remarks
            </p>
            <p className="text-sm italic text-foreground/80">
              &ldquo;{application.approverRemarks}&rdquo;
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
