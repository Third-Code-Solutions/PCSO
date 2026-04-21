/**
 * EWB-003 — Retirement annual list + generate notices.
 */

import type { Metadata } from "next";

import { PageHeader } from "@/components/layouts/page-header";
import { RoleGate } from "@/components/role-gate";
import { requireAuth } from "@/lib/auth/guards";
import {
  generateAnnualNotices,
  listPendingNotices,
} from "@/lib/actions/ewbm/retirement";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RetirementEligibilityTable,
  type RetirementNoticeDisplayRow,
} from "@/components/welfare/retirement-eligibility-table";

export const metadata: Metadata = {
  title: "Retirement Notices",
};

async function handleGenerate() {
  "use server";
  const year = new Date().getFullYear();
  await generateAnnualNotices({ year });
}

export default async function RetirementListPage() {
  const user = await requireAuth();
  const year = new Date().getFullYear();

  const result = await listPendingNotices({ year });
  const rows: RetirementNoticeDisplayRow[] =
    "data" in result
      ? result.data.map((r) => ({
          id: r.id,
          employeeId: r.employeeId,
          retirementType: r.retirementType,
          eligibleDate: r.eligibleDate,
          monthsUntilEligible: r.monthsUntilEligible,
          status: r.status,
        }))
      : [];

  const fetchError = "error" in result ? result.error : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Retirement Notices · ${year}`}
        description="Employees reaching optional or compulsory retirement within 12 months."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Welfare", href: "/welfare" },
          { label: "Retirement" },
        ]}
        actions={
          <RoleGate
            role={user.role}
            roles={["super_admin", "hr_admin"]}
            fallback={null}
          >
            <form action={handleGenerate}>
              <Button type="submit" size="sm">
                Generate now
              </Button>
            </form>
          </RoleGate>
        }
      />

      {fetchError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {fetchError}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eligibility roster</CardTitle>
        </CardHeader>
        <CardContent>
          <RetirementEligibilityTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
