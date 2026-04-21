/**
 * /leave/calendar — Team/office leave calendar
 *
 * Query parameters:
 *   ?month=YYYY-MM   (defaults to current month)
 *   ?officeId=<uuid> or "all"  (privileged roles only; ignored otherwise)
 */

import { requireAuth } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layouts/page-header";
import { LeaveCalendar } from "@/components/leave/leave-calendar";
import { getApprovedLeavesForCalendar } from "@/app/(dashboard)/leave/queries";
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  parse,
  isValid,
} from "date-fns";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leave Calendar",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseMonth(raw: string | undefined): Date {
  if (!raw) return new Date();
  const parsed = parse(raw, "yyyy-MM", new Date());
  return isValid(parsed) ? parsed : new Date();
}

export default async function LeaveCalendarPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;

  const canViewAllOffices =
    user.role === "super_admin" ||
    user.role === "hr_admin" ||
    hasPermission(user.role, "leave", "approve");

  const rawMonth = Array.isArray(params["month"])
    ? params["month"][0]
    : params["month"];
  const rawOfficeId = Array.isArray(params["officeId"])
    ? params["officeId"][0]
    : params["officeId"];

  const month = parseMonth(rawMonth);
  const monthKey = format(month, "yyyy-MM");
  const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");

  // For non-privileged users, force scope to their own office.
  const effectiveOfficeId = canViewAllOffices
    ? rawOfficeId && rawOfficeId !== "all"
      ? rawOfficeId
      : undefined
    : (user.officeId ?? undefined);

  let offices: Array<{ id: string; name: string; code: string }> = [];
  if (canViewAllOffices) {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("offices")
      .select("id, name, code")
      .is("deleted_at", null)
      .order("name");
    offices = (data ?? []).map((o) => ({
      id: String(o.id),
      name: String(o.name),
      code: String(o.code),
    }));
  }

  const entries = await getApprovedLeavesForCalendar(
    monthStart,
    monthEnd,
    effectiveOfficeId,
  );

  const PHILIPPINE_HOLIDAYS = [
    { date: "2025-01-01", name: "New Year's Day" },
    { date: "2025-04-09", name: "Araw ng Kagitingan" },
    { date: "2025-04-17", name: "Maundy Thursday" },
    { date: "2025-04-18", name: "Good Friday" },
    { date: "2025-05-01", name: "Labor Day" },
    { date: "2025-06-12", name: "Independence Day" },
    { date: "2025-08-25", name: "National Heroes Day" },
    { date: "2025-11-30", name: "Bonifacio Day" },
    { date: "2025-12-25", name: "Christmas Day" },
    { date: "2025-12-30", name: "Rizal Day" },
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-04-02", name: "Maundy Thursday" },
    { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-04-09", name: "Araw ng Kagitingan" },
    { date: "2026-05-01", name: "Labor Day" },
  ];

  const prevMonthKey = format(subMonths(month, 1), "yyyy-MM");
  const nextMonthKey = format(addMonths(month, 1), "yyyy-MM");

  function buildHref(extra: Record<string, string | undefined>): string {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined) usp.set(k, v);
    }
    const qs = usp.toString();
    return qs ? `/leave/calendar?${qs}` : "/leave/calendar";
  }

  const officeFilterValue = effectiveOfficeId ?? "all";

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <RealtimeBoundary tables={["leave_applications"]} />
      <PageHeader
        title="Leave Calendar"
        description={
          effectiveOfficeId
            ? "Approved leaves for the selected office and month."
            : "Approved leaves across all offices."
        }
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leave", href: "/leave" },
          { label: "Calendar" },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link
              href={buildHref({ month: prevMonthKey, officeId: rawOfficeId })}
              aria-label="Previous month"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={buildHref({ officeId: rawOfficeId })}>Today</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link
              href={buildHref({ month: nextMonthKey, officeId: rawOfficeId })}
              aria-label="Next month"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </Button>
          <span className="ml-3 text-sm font-medium text-pcso-navy">
            {format(month, "MMMM yyyy")}
          </span>
        </div>

        {canViewAllOffices && offices.length > 0 && (
          <form
            method="get"
            action="/leave/calendar"
            className="flex items-center gap-2"
          >
            <label
              htmlFor="officeId"
              className="text-xs font-medium text-muted-foreground"
            >
              Office
            </label>
            <input type="hidden" name="month" value={monthKey} />
            <select
              id="officeId"
              name="officeId"
              defaultValue={officeFilterValue}
              className="h-9 rounded-md border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-pcso-gold"
            >
              <option value="all">All offices</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="outline">
              Apply
            </Button>
          </form>
        )}
      </div>

      <LeaveCalendar
        entries={entries}
        holidays={PHILIPPINE_HOLIDAYS}
        initialMonth={month}
        hideControls
      />

      <p
        className="mt-3 text-xs text-muted-foreground text-center"
        aria-live="polite"
        role="status"
      >
        Showing {entries.length} approved leave{entries.length !== 1 ? "s" : ""}{" "}
        for {format(month, "MMMM yyyy")}. Philippine public holidays are
        highlighted in amber.
      </p>
    </main>
  );
}
