/**
 * Personnel Complement Report — TOR 1.3.21
 *
 * Total employees, male/female split, plantilla positions (total / filled /
 * vacant), per-office counts, and Main (Head) Office vs branches split
 * derived from the offices hierarchy.
 */

import { Badge } from "@/components/ui/badge";
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
import { requirePermission } from "@/lib/auth/guards";
import { getPersonnelComplementReport } from "@/lib/actions/reports/workforce-reports";
import { buildCsvFromTable } from "@/lib/utils/pimm/adhoc-report";
import { CsvExportButton } from "../_components/csv-export-button";

export const metadata = {
  title: "Personnel Complement Report",
  description:
    "Headcount, sex split, plantilla utilization, and office distribution.",
};

export default async function PersonnelComplementPage() {
  await requirePermission("reports", "view");
  const report = await getPersonnelComplementReport();
  const { summary, byOffice } = report;

  const csv = buildCsvFromTable(
    [
      "Office",
      "Group",
      "Employees",
      "Male",
      "Female",
      "Other / Undisclosed",
      "Plantilla Positions",
      "Filled",
      "Vacant",
    ],
    byOffice.map((row) => [
      row.officeName,
      row.officeGroup === "branch" ? "Branch" : "Head Office",
      String(row.totalEmployees),
      String(row.maleCount),
      String(row.femaleCount),
      String(row.otherGenderCount),
      String(row.plantillaTotal),
      String(row.plantillaFilled),
      String(row.plantillaVacant),
    ]),
  );

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-pcso-navy">
            Personnel Complement Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Active headcount, plantilla utilization, and office distribution
            (TOR 1.3.21)
          </p>
        </div>
        <CsvExportButton fileName="personnel-complement-report.csv" csv={csv} />
      </header>

      {/* Headcount summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Active Employees</CardDescription>
            <CardTitle className="text-2xl">{summary.totalEmployees}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Male</CardDescription>
            <CardTitle className="text-2xl">{summary.maleCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Female</CardDescription>
            <CardTitle className="text-2xl">{summary.femaleCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Other / Undisclosed</CardDescription>
            <CardTitle className="text-2xl">
              {summary.otherGenderCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Plantilla summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Plantilla Positions</CardDescription>
            <CardTitle className="text-2xl">{summary.plantillaTotal}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Filled</CardDescription>
            <CardTitle className="text-2xl text-green-700">
              {summary.plantillaFilled}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vacant</CardDescription>
            <CardTitle className="text-2xl text-amber-700">
              {summary.plantillaVacant}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Head Office vs Branches */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Head Office (incl. sectors)</CardDescription>
            <CardTitle className="text-2xl">
              {summary.headOfficeEmployees}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Branches (NCL / STBR / VIS / MIN)</CardDescription>
            <CardTitle className="text-2xl">
              {summary.branchEmployees}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unassigned (no office)</CardDescription>
            <CardTitle className="text-2xl">
              {summary.unassignedEmployees}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Per-office table */}
      <Card>
        <CardHeader>
          <CardTitle>Per-Office Complement</CardTitle>
          <CardDescription>
            Employee headcount and plantilla utilization per office
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {byOffice.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">
              No offices or employees on record.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Office</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead className="text-right">Employees</TableHead>
                  <TableHead className="text-right">Male</TableHead>
                  <TableHead className="text-right">Female</TableHead>
                  <TableHead className="text-right">Plantilla</TableHead>
                  <TableHead className="text-right">Filled</TableHead>
                  <TableHead className="text-right">Vacant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byOffice.map((row) => (
                  <TableRow key={row.officeId || "unassigned"}>
                    <TableCell className="font-medium">
                      {row.officeName}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.officeGroup === "branch"
                            ? "bg-blue-100 text-blue-800 border-blue-200"
                            : "bg-slate-100 text-slate-800 border-slate-200"
                        }
                      >
                        {row.officeGroup === "branch"
                          ? "Branch"
                          : "Head Office"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.totalEmployees}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.maleCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.femaleCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.plantillaTotal}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.plantillaFilled}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.plantillaVacant}
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
