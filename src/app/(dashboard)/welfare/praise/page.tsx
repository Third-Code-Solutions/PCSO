/**
 * EWB-004 — PRAISE advance notices list.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layouts/page-header";
import { RoleGate } from "@/components/role-gate";
import { requireAuth } from "@/lib/auth/guards";
import { listNotices } from "@/lib/actions/ewbm/praise";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  title: "PRAISE Advance Notices",
};

type PraiseStatus = "draft" | "sent" | "processed";

const STATUS_VARIANT: Record<PraiseStatus, "warning" | "info" | "success"> = {
  draft: "warning",
  sent: "info",
  processed: "success",
};

function variantFor(status: string): "warning" | "info" | "success" {
  return STATUS_VARIANT[status as PraiseStatus] ?? "warning";
}

export default async function PraiseListPage() {
  const user = await requireAuth();

  const result = await listNotices({ filter: {} });
  const rows = "data" in result ? result.data : [];
  const fetchError = "error" in result ? result.error : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="PRAISE Advance Notices"
        description="Advance notifications to the Payroll Master for incentive-eligible periods."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Welfare", href: "/welfare" },
          { label: "PRAISE" },
        ]}
        actions={
          <RoleGate
            role={user.role}
            roles={["super_admin", "hr_admin"]}
            fallback={null}
          >
            <Button asChild size="sm">
              <Link href="/welfare/praise/new">New notice</Link>
            </Button>
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
          <CardTitle className="text-base">Notices</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No PRAISE notices yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Eligible</TableHead>
                  <TableHead>Projected</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums">
                      {r.payrollPeriodStart} → {r.payrollPeriodEnd}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.eligibleCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.totalProjectedAmount ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={variantFor(r.status)}
                        className="capitalize"
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {r.noticeSentAt
                        ? new Date(r.noticeSentAt).toISOString().slice(0, 10)
                        : "—"}
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
