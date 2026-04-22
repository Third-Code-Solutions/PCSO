/**
 * ComplianceDashboard — SALN compliance tracker for super_admin
 *
 * Displays all employees with their annual SALN filing status.
 * Supports filtering by status, bulk reminder emails, and CSV export.
 * Access is restricted to super_admin only.
 */

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  MailIcon,
  DownloadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ComplianceRow } from "@/app/(dashboard)/saln/queries";
import type { SalnStatus } from "@/lib/validations/saln";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterStatus = "all" | "filed" | "not_filed" | "late";

interface ComplianceDashboardProps {
  rows: ComplianceRow[];
  year: number;
  /** Omit to render the Send Reminders button as hidden (read-only roles). */
  onSendReminders?: (
    employeeIds: string[],
  ) => Promise<{ sent: number; failed: number }>;
  /** Omit to render the Export CSV button as hidden (read-only roles). */
  onExport?: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(row: ComplianceRow) {
  if (!row.hasFiled) {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircleIcon className="h-3 w-3" aria-hidden />
        Not Filed
      </Badge>
    );
  }
  if (row.isLate) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-orange-400 text-orange-600"
      >
        <ClockIcon className="h-3 w-3" aria-hidden />
        Filed Late
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-green-500 text-green-700">
      <CheckCircleIcon className="h-3 w-3" aria-hidden />
      Filed On Time
    </Badge>
  );
}

function salnStatusLabel(status: SalnStatus | null): string {
  if (!status) return "—";
  const labels: Record<SalnStatus, string> = {
    draft: "Draft",
    submitted: "Submitted",
    received: "Received",
    verified: "Verified",
    deficient: "Deficient",
  };
  return labels[status] ?? status;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComplianceDashboard({
  rows,
  year,
  onSendReminders,
  onExport,
}: ComplianceDashboardProps) {
  const [isPending, startTransition] = useTransition();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Apply filters
  const filtered = rows.filter((row) => {
    const matchesSearch =
      search === "" ||
      row.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      row.employeeNo.toLowerCase().includes(search.toLowerCase()) ||
      row.positionTitle.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "filed" && row.hasFiled && !row.isLate) ||
      (filterStatus === "not_filed" && !row.hasFiled) ||
      (filterStatus === "late" && row.isLate);

    return matchesSearch && matchesStatus;
  });

  const totalFiled = rows.filter((r) => r.hasFiled && !r.isLate).length;
  const totalLate = rows.filter((r) => r.isLate).length;
  const totalNotFiled = rows.filter((r) => !r.hasFiled).length;
  const complianceRate =
    rows.length > 0 ? Math.round((totalFiled / rows.length) * 100) : 0;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllNonFilers() {
    const nonFilerIds = filtered
      .filter((r) => !r.hasFiled)
      .map((r) => r.employeeId);
    setSelected(new Set(nonFilerIds));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function handleSendReminders() {
    if (!onSendReminders) return;
    const ids =
      selected.size > 0
        ? [...selected]
        : rows.filter((r) => !r.hasFiled).map((r) => r.employeeId);

    startTransition(async () => {
      try {
        const result = await onSendReminders(ids);
        toast.success(`Reminders sent to ${result.sent} employee(s)`, {
          description:
            result.failed > 0
              ? `${result.failed} reminder(s) failed to send. Check non-filer list.`
              : undefined,
        });
        clearSelection();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to send reminders.";
        toast.error("Send failed", { description: message });
      }
    });
  }

  function handleExport() {
    if (!onExport) return;
    startTransition(async () => {
      try {
        await onExport();
        toast.success("Export complete", {
          description: "SALN compliance list downloaded as CSV.",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Export failed.";
        toast.error("Export failed", { description: message });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Employees</p>
          <p className="mt-1 text-2xl font-bold text-pcso-navy">
            {rows.length}
          </p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-xs text-green-700">Filed On Time</p>
          <p className="mt-1 text-2xl font-bold text-green-800">{totalFiled}</p>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs text-orange-700">Filed Late</p>
          <p className="mt-1 text-2xl font-bold text-orange-800">{totalLate}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-700">Not Filed</p>
          <p className="mt-1 text-2xl font-bold text-red-800">
            {totalNotFiled}
          </p>
        </div>
      </div>

      {/* Compliance rate bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            Compliance Rate — {year}
          </span>
          <span className="font-semibold text-pcso-navy">
            {complianceRate}%
          </span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={complianceRate}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${complianceRate}% compliance rate`}
        >
          <div
            className="h-full rounded-full bg-pcso-navy transition-all"
            style={{ width: `${complianceRate}%` }}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name, employee no., or position..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          aria-label="Search employees"
        />

        <Select
          value={filterStatus}
          onValueChange={(v) => setFilterStatus(v as FilterStatus)}
        >
          <SelectTrigger className="w-36" aria-label="Filter by filing status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="filed">Filed</SelectItem>
            <SelectItem value="not_filed">Not Filed</SelectItem>
            <SelectItem value="late">Late</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <span className="text-sm text-muted-foreground">
              {selected.size} selected
            </span>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selectAllNonFilers}
            disabled={isPending || totalNotFiled === 0}
          >
            Select Non-Filers
          </Button>

          {onSendReminders && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={handleSendReminders}
            >
              <MailIcon className="mr-1.5 h-4 w-4" aria-hidden />
              {selected.size > 0
                ? `Send Reminders (${selected.size})`
                : "Remind All Non-Filers"}
            </Button>
          )}

          {onExport && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={handleExport}
            >
              <DownloadIcon className="mr-1.5 h-4 w-4" aria-hidden />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <span className="sr-only">Select</span>
              </TableHead>
              <TableHead>Employee No.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>SALN Status</TableHead>
              <TableHead>Date Filed</TableHead>
              <TableHead className="w-20">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-8 text-center text-muted-foreground"
                >
                  No records found.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((row) => (
              <TableRow
                key={row.employeeId}
                className={
                  selected.has(row.employeeId) ? "bg-muted/40" : undefined
                }
              >
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(row.employeeId)}
                    onChange={() => toggleSelect(row.employeeId)}
                    aria-label={`Select ${row.employeeName}`}
                    className="h-4 w-4 rounded border-border"
                    disabled={row.hasFiled}
                  />
                </TableCell>
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
                <TableCell>{statusBadge(row)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {salnStatusLabel(row.status)}
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {row.dateFiled ?? "—"}
                </TableCell>
                <TableCell>
                  {row.submissionId && (
                    <a
                      href={`/saln/${row.submissionId}`}
                      className="text-xs text-pcso-navy underline hover:no-underline"
                    >
                      View
                    </a>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {rows.length} employees.
      </p>
    </div>
  );
}
