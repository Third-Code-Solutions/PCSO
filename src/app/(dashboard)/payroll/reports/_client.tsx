"use client";

/**
 * Payroll ad hoc report builder client — TOR 1.8.15.
 *
 * Filters + column multi-select over PAYROLL_REPORT_SELECTABLE_COLUMNS →
 * getPayrollAdHocReport → shaped table with money totals → BOM-prefixed CSV
 * download (house Excel convention, mirrors leave advanced reports).
 */

import * as React from "react";
import { toast } from "sonner";
import { Download, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPayrollAdHocReport } from "@/lib/actions/payroll-gaps";
import {
  PAYROLL_REPORT_SELECTABLE_COLUMNS,
  PAYROLL_REPORT_DEFAULT_COLUMN_KEYS,
  shapePayrollReport,
  buildReportCsv,
  type PayrollReportRow,
} from "@/lib/utils/payroll/report-builder";

interface OfficeOption {
  id: string;
  name: string;
}

interface Props {
  offices: OfficeOption[];
}

const ALL = "__all__";

const SCOPE_OPTIONS = [
  { value: ALL, label: "All payroll types" },
  { value: "regular", label: "General (Regular)" },
  { value: "jo_cos", label: "JO / COS" },
  { value: "rata", label: "RATA" },
  { value: "cash_advance", label: "Cash Advance" },
  { value: "benefits_bonuses", label: "Benefits & Bonuses" },
  { value: "salary_differential", label: "Salary Differential" },
  { value: "special", label: "Special" },
  { value: "magna_carta", label: "Magna Carta" },
  { value: "confidential_agents", label: "Confidential Agents" },
] as const;

function isNextRedirect(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest: string }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_")
  );
}

export function PayrollReportsClient({ offices }: Props) {
  const [isPending, startTransition] = React.useTransition();

  // Filters
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState("");
  const [scope, setScope] = React.useState<string>(ALL);
  const [officeId, setOfficeId] = React.useState<string>(ALL);
  const [finalizedOnly, setFinalizedOnly] = React.useState(false);

  // Column selection
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(
    () => new Set(PAYROLL_REPORT_DEFAULT_COLUMN_KEYS),
  );

  // Results
  const [rows, setRows] = React.useState<PayrollReportRow[] | null>(null);
  const [truncated, setTruncated] = React.useState(false);

  const shaped = React.useMemo(
    () => (rows ? shapePayrollReport(rows, [...selectedKeys]) : null),
    [rows, selectedKeys],
  );

  function toggleColumn(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleRun() {
    startTransition(async () => {
      try {
        const result = await getPayrollAdHocReport({
          periodStart,
          periodEnd,
          scope: scope === ALL ? "" : scope,
          officeId: officeId === ALL ? "" : officeId,
          finalizedOnly,
        });
        setRows(result.rows);
        setTruncated(result.truncated);
        if (result.rows.length === 0) {
          toast.info("No payroll records match the selected filters.");
        }
      } catch (err) {
        if (isNextRedirect(err)) throw err;
        toast.error(err instanceof Error ? err.message : "Report failed");
      }
    });
  }

  function handleDownloadCsv() {
    if (!shaped || shaped.rows.length === 0) return;
    const csv = buildReportCsv(shaped);
    // UTF-8 BOM so Excel opens the file with correct encoding (house convention).
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="report-period-start">Period from</Label>
              <Input
                id="report-period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-period-end">Period to</Label>
              <Input
                id="report-period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payroll type</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger>
                  <SelectValue placeholder="All payroll types" />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Office</Label>
              <Select value={officeId} onValueChange={setOfficeId}>
                <SelectTrigger>
                  <SelectValue placeholder="All offices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All offices</SelectItem>
                  {offices.map((office) => (
                    <SelectItem key={office.id} value={office.id}>
                      {office.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="report-finalized-only"
              checked={finalizedOnly}
              onCheckedChange={(checked) => setFinalizedOnly(checked === true)}
            />
            <Label
              htmlFor="report-finalized-only"
              className="text-sm font-normal"
            >
              Finalized runs only (approved / paid)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Column picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Columns ({selectedKeys.size} selected)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
            {PAYROLL_REPORT_SELECTABLE_COLUMNS.map((col) => (
              <div key={col.key} className="flex items-center gap-2">
                <Checkbox
                  id={`col-${col.key}`}
                  checked={selectedKeys.has(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                />
                <Label
                  htmlFor={`col-${col.key}`}
                  className="text-sm font-normal"
                >
                  {col.label}
                </Label>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Employee, office, position, and period identity columns are always
            included. When nothing is selected, the default set (Gross, Total
            Deductions, Net Pay) is used.
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleRun}
          disabled={isPending}
          className="bg-[#0B2545] text-white hover:bg-[#13315C]"
        >
          <Play className="mr-2 h-4 w-4" />
          {isPending ? "Running..." : "Run Report"}
        </Button>
        <Button
          variant="outline"
          onClick={handleDownloadCsv}
          disabled={!shaped || shaped.rows.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Download CSV
        </Button>
        {rows && (
          <span className="text-sm text-muted-foreground">
            {rows.length.toLocaleString()} record{rows.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {truncated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The report hit the 5,000-row cap — narrow the filters for exact
          totals.
        </div>
      )}

      {/* Results */}
      {shaped && shaped.rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                {shaped.columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={col.isMoney ? "text-right" : ""}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shaped.rows.map((row, rowIdx) => (
                <TableRow key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <TableCell
                      key={cellIdx}
                      className={
                        shaped.columns[cellIdx]?.isMoney
                          ? "text-right font-mono text-sm"
                          : "text-sm"
                      }
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                {shaped.totals.map((cell, cellIdx) => (
                  <TableCell
                    key={cellIdx}
                    className={
                      shaped.columns[cellIdx]?.isMoney
                        ? "text-right font-mono text-sm font-semibold"
                        : "text-sm font-semibold"
                    }
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium text-muted-foreground">
            No matching records
          </p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Adjust the period range or filters and run again.
          </p>
        </div>
      )}
    </div>
  );
}
