/**
 * EWB-005 — Wellness reports list + generate-new.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layouts/page-header";
import { RoleGate } from "@/components/role-gate";
import { requireAuth } from "@/lib/auth/guards";
import { generateReport, listReports } from "@/lib/actions/ewbm/wellness";
import { Button } from "@/components/ui/button";
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
  title: "Wellness Reports",
};

async function handleGenerate(formData: FormData) {
  "use server";
  const period = String(formData.get("reportPeriod") ?? "").trim();
  if (!period) return;
  await generateReport({ reportPeriod: period });
}

export default async function WellnessListPage() {
  const user = await requireAuth();
  const result = await listReports({});
  const rows = "data" in result ? result.data : [];
  const fetchError = "error" in result ? result.error : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wellness Reports"
        description="Aggregated skills & hobbies per reporting period."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Welfare", href: "/welfare" },
          { label: "Wellness" },
        ]}
      />

      {fetchError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {fetchError}
        </p>
      )}

      <RoleGate
        role={user.role}
        roles={["super_admin", "hr_admin"]}
        fallback={null}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generate a new report</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={handleGenerate}
              className="flex flex-wrap items-end gap-3"
            >
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-muted-foreground">
                  Report period (e.g. 2026-Q1)
                </span>
                <input
                  name="reportPeriod"
                  type="text"
                  pattern="[0-9]{4}-(Q[1-4]|H[1-2]|[0-1][0-9])"
                  placeholder="2026-Q1"
                  required
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                />
              </label>
              <Button type="submit" size="sm">
                Generate report
              </Button>
            </form>
          </CardContent>
        </Card>
      </RoleGate>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Previous reports</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No wellness reports yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Employees counted</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.reportPeriod}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {r.generatedAt
                        ? new Date(r.generatedAt).toISOString().slice(0, 10)
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.totalEmployeesCounted.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/welfare/wellness/${r.id}`}>Open</Link>
                      </Button>
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
