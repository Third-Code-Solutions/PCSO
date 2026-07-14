"use client";

/**
 * HR accomplishment report client — TOR 1.3.24.
 * Date-range filter → per-processor statistics table with totals + CSV.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ClipboardCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getHRAccomplishmentReport } from "@/lib/actions/reports/workforce-reports";
import { buildCsvFromTable } from "@/lib/utils/pimm/adhoc-report";
import { CsvExportButton } from "../_components/csv-export-button";

type AccomplishmentResult = Awaited<
  ReturnType<typeof getHRAccomplishmentReport>
>;

function isoDate(date: Date): string {
  return date.toISOString().split("T")[0] ?? "";
}

function byTypeSummary(byType: Record<string, number>): string {
  return Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${type}: ${count}`)
    .join(" · ");
}

export function HrAccomplishmentsClient() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AccomplishmentResult | null>(null);
  const [filters, setFilters] = useState({
    dateFrom: isoDate(monthStart),
    dateTo: isoDate(today),
  });

  function handleGenerate() {
    if (!filters.dateFrom || !filters.dateTo) {
      toast.error("Set a start and end date first.");
      return;
    }
    startTransition(async () => {
      try {
        const report = await getHRAccomplishmentReport(filters);
        setResult(report);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to generate report.",
        );
      }
    });
  }

  const csv = result
    ? buildCsvFromTable(
        [
          "HR Processor",
          "Document Requests Handled",
          "Released",
          "Ready",
          "Disapproved",
          "By Document Type",
          "PDS Updates Approved",
          "201 Documents Validated",
          "Total Actions",
        ],
        [
          ...result.data.map((r) => [
            r.processorName,
            String(r.docRequestsHandled),
            String(r.docRequestsReleased),
            String(r.docRequestsReady),
            String(r.docRequestsDisapproved),
            byTypeSummary(r.docRequestsByType),
            String(r.pdsUpdatesApproved),
            String(r.documentsValidated),
            String(r.totalActions),
          ]),
          [
            `TOTAL (${result.total} processors)`,
            String(result.totals.docRequestsHandled),
            String(result.totals.docRequestsReleased),
            String(result.totals.docRequestsReady),
            String(result.totals.docRequestsDisapproved),
            "",
            String(result.totals.pdsUpdatesApproved),
            String(result.totals.documentsValidated),
            String(result.totals.totalActions),
          ],
        ],
      )
    : "";

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Reporting Period</CardTitle>
          <CardDescription>
            Statistics count state transitions that occurred within the range
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="dateFrom">Start Date</Label>
            <Input
              id="dateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                setFilters({ ...filters, dateFrom: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateTo">End Date</Label>
            <Input
              id="dateTo"
              type="date"
              value={filters.dateTo}
              onChange={(e) =>
                setFilters({ ...filters, dateTo: e.target.value })
              }
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleGenerate}
              disabled={isPending}
              className="w-full gap-2"
            >
              <FileText className="h-4 w-4" />
              {isPending ? "Generating..." : "Generate Report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Document Requests Handled</CardDescription>
                <CardTitle className="text-2xl">
                  {result.totals.docRequestsHandled}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>PDS Updates Approved</CardDescription>
                <CardTitle className="text-2xl">
                  {result.totals.pdsUpdatesApproved}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>201 Documents Validated</CardDescription>
                <CardTitle className="text-2xl">
                  {result.totals.documentsValidated}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Actions</CardDescription>
                <CardTitle className="text-2xl">
                  {result.totals.totalActions}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Per-processor table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Per-Processor Accomplishments</CardTitle>
                <CardDescription>
                  {filters.dateFrom} to {filters.dateTo} — {result.total} HR
                  processor{result.total === 1 ? "" : "s"}
                </CardDescription>
              </div>
              <CsvExportButton
                fileName={`hr-accomplishments-${filters.dateFrom}-to-${filters.dateTo}.csv`}
                csv={csv}
              />
            </CardHeader>
            <CardContent className="p-0">
              {result.data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <ClipboardCheck className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-center text-muted-foreground">
                    No HR processing activity recorded in the selected period.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>HR Processor</TableHead>
                      <TableHead className="text-right">Doc Requests</TableHead>
                      <TableHead className="text-right">Released</TableHead>
                      <TableHead className="text-right">Ready</TableHead>
                      <TableHead className="text-right">Disapproved</TableHead>
                      <TableHead>By Type</TableHead>
                      <TableHead className="text-right">PDS Approved</TableHead>
                      <TableHead className="text-right">
                        Docs Validated
                      </TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.data.map((record) => (
                      <TableRow key={record.processorId}>
                        <TableCell className="font-medium">
                          {record.processorName}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.docRequestsHandled}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.docRequestsReleased}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.docRequestsReady}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.docRequestsDisapproved}
                        </TableCell>
                        <TableCell className="max-w-56 text-xs text-muted-foreground">
                          {byTypeSummary(record.docRequestsByType) || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.pdsUpdatesApproved}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.documentsValidated}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {record.totalActions}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        {result.totals.docRequestsHandled}
                      </TableCell>
                      <TableCell className="text-right">
                        {result.totals.docRequestsReleased}
                      </TableCell>
                      <TableCell className="text-right">
                        {result.totals.docRequestsReady}
                      </TableCell>
                      <TableCell className="text-right">
                        {result.totals.docRequestsDisapproved}
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-right">
                        {result.totals.pdsUpdatesApproved}
                      </TableCell>
                      <TableCell className="text-right">
                        {result.totals.documentsValidated}
                      </TableCell>
                      <TableCell className="text-right">
                        {result.totals.totalActions}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
