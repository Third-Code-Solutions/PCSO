/**
 * EWB-002 — Awardees detail for a single loyalty award run.
 *
 * HR (employees:edit) records each grant here (H-22); granted milestones
 * exclude the employee from later runs.
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { PageHeader } from "@/components/layouts/page-header";
import { requireAuth } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { loyaltyAwardRuns } from "@/lib/db/schema/welfare";
import {
  listAwardeesForRun,
  markAwardGranted,
} from "@/lib/actions/ewbm/loyalty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Loyalty Run",
};

interface LoyaltyRunPageProps {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function LoyaltyRunPage({
  params,
  searchParams,
}: LoyaltyRunPageProps) {
  const user = await requireAuth();
  const { runId } = await params;
  const { error: actionError } = await searchParams;

  const [run] = await db
    .select()
    .from(loyaltyAwardRuns)
    .where(eq(loyaltyAwardRuns.id, runId))
    .limit(1);

  if (!run) notFound();

  const result = await listAwardeesForRun({ runId });
  const awardees = "data" in result ? result.data : [];
  const fetchError = "error" in result ? result.error : null;
  const canGrant = hasPermission(user.role, "employees", "edit");
  const today = new Date().toISOString().slice(0, 10);

  async function grantAction(formData: FormData) {
    "use server";
    const res = await markAwardGranted({
      awardeeId: formData.get("awardeeId"),
      grantedAt: formData.get("grantedAt"),
    });
    if ("error" in res) {
      redirect(
        `/welfare/loyalty/${runId}?error=${encodeURIComponent(res.error)}`,
      );
    }
    redirect(`/welfare/loyalty/${runId}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Loyalty Run · ${run.runYear}`}
        description={`${run.totalEligible} eligible employee${
          run.totalEligible === 1 ? "" : "s"
        }`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Welfare", href: "/welfare" },
          { label: "Loyalty", href: "/welfare/loyalty" },
          { label: String(run.runYear) },
        ]}
        actions={
          <Button asChild size="sm" variant="outline">
            <a href={`/api/welfare/loyalty/${run.id}/export`} download>
              Export CSV
            </a>
          </Button>
        }
      />

      {(fetchError ?? actionError) && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {fetchError ?? actionError}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Awardees</CardTitle>
        </CardHeader>
        <CardContent>
          {awardees.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No awardees in this run.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Milestone</TableHead>
                  <TableHead>Years of service</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {awardees.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">
                        {a.lastName
                          ? `${a.lastName}, ${a.firstName ?? ""}`
                          : "Unknown employee"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.employeeNo ?? "—"}
                        {a.previousAwardFlag
                          ? " · prior milestone awarded"
                          : ""}
                      </div>
                    </TableCell>
                    <TableCell>{a.milestoneYears} yrs</TableCell>
                    <TableCell className="tabular-nums">
                      {a.yearsOfServiceComputed}
                    </TableCell>
                    <TableCell>
                      {a.awardGrantedAt ? (
                        <Badge variant="secondary">
                          Granted{" "}
                          {new Date(a.awardGrantedAt)
                            .toISOString()
                            .slice(0, 10)}
                        </Badge>
                      ) : canGrant ? (
                        <form
                          action={grantAction}
                          className="flex items-center gap-2"
                        >
                          <input type="hidden" name="awardeeId" value={a.id} />
                          <Input
                            type="date"
                            name="grantedAt"
                            defaultValue={today}
                            required
                            aria-label={`Grant date for ${a.lastName ?? "employee"}`}
                            className="h-8 w-[150px]"
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Mark granted
                          </Button>
                        </form>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
