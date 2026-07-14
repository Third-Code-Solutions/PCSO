"use client";

/**
 * TAM ad hoc report builder client — TOR 1.5.14.
 * Date range + filters + column picker → shaped table + CSV.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SlidersHorizontal, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { getTamAdhocReport } from "@/lib/actions/attendance/tam-reports";
import { buildCsvFromTable } from "@/lib/utils/pimm/adhoc-report";
import { TAM_ADHOC_CATALOG } from "@/lib/utils/attendance/tam-adhoc";
import { CsvExportButton } from "@/app/(dashboard)/reports/_components/csv-export-button";

type AdhocResult = Awaited<ReturnType<typeof getTamAdhocReport>>;

interface TamAdhocClientProps {
  offices: Array<{ id: string; name: string }>;
}

function monthStartValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TamAdhocClient({ offices }: TamAdhocClientProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AdhocResult | null>(null);
  const [dateFrom, setDateFrom] = useState(monthStartValue());
  const [dateTo, setDateTo] = useState(todayValue());
  const [officeId, setOfficeId] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    ...TAM_ADHOC_CATALOG.defaultKeys,
  ]);

  function toggleColumn(key: string) {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function handleGenerate() {
    if (!dateFrom || !dateTo) {
      toast.error("Select a valid date range.");
      return;
    }
    startTransition(async () => {
      try {
        const report = await getTamAdhocReport({
          dateFrom,
          dateTo,
          officeId: officeId || undefined,
          columns: selectedColumns,
        });
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
        result.columns.map((c) => c.label),
        result.rows,
      )
    : "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Choose the period, scope, and columns for the report
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="date-from">From</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-to">To</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="office">Office</Label>
              <Select
                value={officeId || "all"}
                onValueChange={(value) =>
                  setOfficeId(value === "all" ? "" : value)
                }
              >
                <SelectTrigger id="office">
                  <SelectValue placeholder="All Offices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Offices</SelectItem>
                  {offices.map((office) => (
                    <SelectItem key={office.id} value={office.id}>
                      {office.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          </div>

          <div className="space-y-2">
            <Label>Columns</Label>
            <p className="text-xs text-muted-foreground">
              Employee No. and Employee Name are always included.
            </p>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {TAM_ADHOC_CATALOG.selectable.map((col) => (
                <label
                  key={col.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
                >
                  <Checkbox
                    checked={selectedColumns.includes(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                    aria-label={col.label}
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Report Output</CardTitle>
              <CardDescription>
                {result.periodStart} to {result.periodEnd} · {result.total}{" "}
                record{result.total === 1 ? "" : "s"}
              </CardDescription>
            </div>
            <CsvExportButton
              fileName={`tam-adhoc-${result.periodStart}-to-${result.periodEnd}.csv`}
              csv={csv}
            />
          </CardHeader>
          <CardContent className="p-0">
            {result.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <SlidersHorizontal className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-center text-muted-foreground">
                  No records match the selected filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {result.columns.map((col) => (
                        <TableHead key={col.key}>{col.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((row, rowIndex) => (
                      <TableRow key={`${row[0]}-${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          <TableCell
                            key={`${rowIndex}-${cellIndex}`}
                            className={cellIndex >= 2 ? "tabular-nums" : ""}
                          >
                            {cell || "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
