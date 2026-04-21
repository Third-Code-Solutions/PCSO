/**
 * Retirement Eligibility Report
 * PRD PIM-019
 *
 * Lists employees eligible for retirement:
 * - Optional: age ≥ 60 AND ≥ 15 years service
 * - Compulsory: age ≥ 65
 *
 * Filterable by office/sector/department/branch and date range.
 * Includes months remaining to eligibility.
 */

import { Suspense } from "react";
import { Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getRetirementEligibilityReport,
  getOfficesForReportFilters,
} from "@/lib/actions/reports/workforce-reports";

export const metadata = {
  title: "Retirement Eligibility Report",
  description:
    "View employees eligible for optional and compulsory retirement.",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[]>>;
}

async function RetirementReportTable({
  officeId,
  eligibilityType,
  monthsAhead,
}: {
  officeId?: string;
  eligibilityType: "optional" | "compulsory" | "all";
  monthsAhead: number;
}) {
  const result = await getRetirementEligibilityReport({
    officeId,
    eligibilityType,
    monthsAhead,
  });

  if (result.data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No employees eligible for retirement within the selected period.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Years of Service</TableHead>
              <TableHead>Eligibility Type</TableHead>
              <TableHead>Eligibility Date</TableHead>
              <TableHead>Months Until</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{record.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {record.employeeNo}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{record.position}</TableCell>
                <TableCell>{record.office}</TableCell>
                <TableCell>{record.currentAge} years</TableCell>
                <TableCell>{record.yearsOfService} years</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      record.eligibilityType === "compulsory"
                        ? "bg-red-100 text-red-800 border-red-200"
                        : "bg-blue-100 text-blue-800 border-blue-200"
                    }
                  >
                    {record.eligibilityType === "compulsory"
                      ? "Compulsory"
                      : "Optional"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(record.eligibilityDate).toLocaleDateString(
                    "en-US",
                    {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    },
                  )}
                </TableCell>
                <TableCell>
                  {record.monthsUntilEligible === 0 ? (
                    <span className="text-green-600 font-medium">
                      Eligible now
                    </span>
                  ) : (
                    `${record.monthsUntilEligible} months`
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

async function Filters() {
  const offices = await getOfficesForReportFilters();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
        <CardDescription>Customize the report parameters</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="office" className="text-sm font-medium mb-2 block">
            Office
          </label>
          <Select name="office">
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

        <div>
          <label htmlFor="type" className="text-sm font-medium mb-2 block">
            Eligibility Type
          </label>
          <Select name="type" defaultValue="all">
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="optional">
                Optional (60+ with 15yrs)
              </SelectItem>
              <SelectItem value="compulsory">Compulsory (65+)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="months" className="text-sm font-medium mb-2 block">
            Look-ahead Period
          </label>
          <Select name="months" defaultValue="12">
            <SelectTrigger id="months">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6 months</SelectItem>
              <SelectItem value="12">12 months</SelectItem>
              <SelectItem value="24">24 months</SelectItem>
              <SelectItem value="36">36 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function RetirementReportPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const officeId =
    typeof params.office === "string" && params.office !== "all"
      ? params.office
      : undefined;

  const eligibilityType = (
    typeof params.type === "string" &&
    ["optional", "compulsory", "all"].includes(params.type)
      ? params.type
      : "all"
  ) as "optional" | "compulsory" | "all";

  const monthsAhead =
    typeof params.months === "string" ? parseInt(params.months, 10) : 12;

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-pcso-navy">
            Retirement Eligibility Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Optional (60+ with 15 years) and Compulsory (65+) retirement
            eligibility
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export Excel
        </Button>
      </header>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Eligible Now (All Types)</CardDescription>
            <CardTitle className="text-2xl">0</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Optional Retirement</CardDescription>
            <CardTitle className="text-2xl">0</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Compulsory Retirement</CardDescription>
            <CardTitle className="text-2xl">0</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Suspense fallback={<Card className="p-6">Loading filters...</Card>}>
        <Filters />
      </Suspense>

      {/* Report Table */}
      <Suspense fallback={<Card className="p-6">Loading report...</Card>}>
        <RetirementReportTable
          officeId={officeId}
          eligibilityType={eligibilityType}
          monthsAhead={monthsAhead}
        />
      </Suspense>
    </div>
  );
}
