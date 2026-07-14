"use client";

/**
 * Step increment eligibility report client — TOR 1.3.15.
 * Office filter → eligible-employee table + CSV export.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { getStepIncrementEligibilityReport } from "@/lib/actions/reports/workforce-reports";
import { buildCsvFromTable } from "@/lib/utils/pimm/adhoc-report";
import { CsvExportButton } from "../_components/csv-export-button";

type StepIncrementResult = Awaited<
  ReturnType<typeof getStepIncrementEligibilityReport>
>;

const TRIGGER_RULE_LABELS: Record<string, string> = {
  three_consecutive_vs: "3× Very Satisfactory",
  two_consecutive_outstanding: "2× Outstanding",
};

function triggerRuleLabel(rule: string): string {
  return TRIGGER_RULE_LABELS[rule] ?? rule;
}

interface StepIncrementsReportClientProps {
  offices: Array<{ id: string; name: string }>;
}

export function StepIncrementsReportClient({
  offices,
}: StepIncrementsReportClientProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<StepIncrementResult | null>(null);
  const [officeId, setOfficeId] = useState("");

  function handleGenerate() {
    startTransition(async () => {
      try {
        const report = await getStepIncrementEligibilityReport({
          officeId: officeId || undefined,
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
        [
          "Employee No",
          "Employee Name",
          "Position",
          "Salary Grade",
          "Current Step",
          "Office",
          "Trigger Rule",
          "Qualifying Periods",
        ],
        result.data.map((r) => [
          r.employeeNo,
          r.fullName,
          r.positionTitle,
          String(r.salaryGrade),
          String(r.currentStep),
          r.officeName ?? "N/A",
          triggerRuleLabel(r.triggerRule),
          r.qualifyingPeriods.join(", "),
        ]),
      )
    : "";

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Eligibility is computed from approved IPCRF ratings; generation may
            take a moment
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
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
              {isPending ? "Computing eligibility..." : "Generate Report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Eligible for Step Increment (NOSI)</CardTitle>
              <CardDescription>
                {result.total} employee{result.total === 1 ? "" : "s"} currently
                eligible
              </CardDescription>
            </div>
            <CsvExportButton
              fileName="step-increment-eligibility-report.csv"
              csv={csv}
            />
          </CardHeader>
          <CardContent className="p-0">
            {result.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-center text-muted-foreground">
                  No employees are currently eligible for a step increment.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Office</TableHead>
                    <TableHead className="text-right">SG</TableHead>
                    <TableHead className="text-right">Current Step</TableHead>
                    <TableHead>Trigger Rule</TableHead>
                    <TableHead>Qualifying Periods</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.data.map((record) => (
                    <TableRow key={record.employeeId}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            {record.employeeNo}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{record.positionTitle}</TableCell>
                      <TableCell>{record.officeName ?? "N/A"}</TableCell>
                      <TableCell className="text-right">
                        {record.salaryGrade}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.currentStep}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            record.triggerRule === "two_consecutive_outstanding"
                              ? "bg-purple-100 text-purple-800 border-purple-200"
                              : "bg-green-100 text-green-800 border-green-200"
                          }
                        >
                          {triggerRuleLabel(record.triggerRule)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {record.qualifyingPeriods.join(", ")}
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
