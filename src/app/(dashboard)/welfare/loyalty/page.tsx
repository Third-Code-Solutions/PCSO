/**
 * EWB-001 / EWB-002 — Loyalty Awards
 *
 * Lists loyalty award runs, and exposes a "Generate new run" form for users
 * with employee:process permission (super_admin + hr_admin).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";

import { PageHeader } from "@/components/layouts/page-header";
import { RoleGate } from "@/components/role-gate";
import { requireAuth } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loyaltyAwardRuns } from "@/lib/db/schema/welfare";
import {
  generateLoyaltyRun,
  historyByMilestone,
} from "@/lib/actions/ewbm/loyalty";
import { hasPermission } from "@/lib/auth/permissions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoyaltyRunForm } from "@/components/welfare/loyalty-run-form";
import type { LoyaltyRunFormInput } from "@/lib/validations/welfare";

export const metadata: Metadata = {
  title: "Loyalty Awards",
};

async function handleGenerate(input: LoyaltyRunFormInput) {
  "use server";
  return generateLoyaltyRun({
    year: input.runYear,
    officeId: input.filterUnitOfficeId ?? undefined,
  });
}

export default async function LoyaltyListPage() {
  const user = await requireAuth();

  const rows = await db
    .select({
      id: loyaltyAwardRuns.id,
      runYear: loyaltyAwardRuns.runYear,
      generatedAt: loyaltyAwardRuns.generatedAt,
      totalEligible: loyaltyAwardRuns.totalEligible,
      exportedAt: loyaltyAwardRuns.exportedAt,
    })
    .from(loyaltyAwardRuns)
    .orderBy(desc(loyaltyAwardRuns.generatedAt))
    .limit(100);

  // EWB-002: historical awardees (granted awards only).
  const history = hasPermission(user.role, "reports", "view")
    ? await historyByMilestone({})
    : null;
  const awardHistory = history && "data" in history ? history.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loyalty Awards"
        description="Annual and milestone-based loyalty award runs."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Welfare", href: "/welfare" },
          { label: "Loyalty" },
        ]}
      />

      <RoleGate
        role={user.role}
        roles={["super_admin", "hr_admin"]}
        fallback={null}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generate a new run</CardTitle>
          </CardHeader>
          <CardContent>
            <LoyaltyRunForm onGenerate={handleGenerate} />
          </CardContent>
        </Card>
      </RoleGate>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No loyalty runs yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Awardees</TableHead>
                  <TableHead>Exported</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums">{r.runYear}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {r.generatedAt
                        ? new Date(r.generatedAt).toISOString().slice(0, 10)
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.totalEligible.toLocaleString()}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {r.exportedAt
                        ? new Date(r.exportedAt).toISOString().slice(0, 10)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/welfare/loyalty/${r.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {history && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Previous awardees</CardTitle>
          </CardHeader>
          <CardContent>
            {"error" in history ? (
              <p className="text-sm text-destructive">{history.error}</p>
            ) : awardHistory.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                No loyalty awards granted yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Milestone</TableHead>
                    <TableHead>Run year</TableHead>
                    <TableHead>Granted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {awardHistory.map((h) => (
                    <TableRow key={h.awardeeId}>
                      <TableCell>
                        {h.lastName
                          ? `${h.lastName}, ${h.firstName ?? ""}`
                          : "Unknown employee"}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {h.employeeNo ?? ""}
                        </span>
                      </TableCell>
                      <TableCell>{h.milestoneYears} yrs</TableCell>
                      <TableCell className="tabular-nums">
                        {h.runYear}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {new Date(h.awardGrantedAt).toISOString().slice(0, 10)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
