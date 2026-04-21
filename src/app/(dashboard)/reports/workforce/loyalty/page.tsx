/**
 * Loyalty Award Eligibility Report
 * PRD PIM-020
 *
 * Lists employees eligible for loyalty awards at milestones:
 * 10, 15, 20, 25, 30, 35, 40, 45 years
 *
 * Based on hire date + current date.
 * Filterable by office/sector/department/branch and milestone.
 */

import { Suspense } from "react";
import { Award, Download } from "lucide-react";
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
  getLoyaltyAwardEligibilityReport,
  getOfficesForReportFilters,
} from "@/lib/actions/reports/workforce-reports";

export const metadata = {
  title: "Loyalty Award Eligibility Report",
  description: "View employees eligible for loyalty awards.",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[]>>;
}

async function LoyaltyReportTable({
  officeId,
  milestone,
  yearFilter,
}: {
  officeId?: string;
  milestone: "10" | "15" | "20" | "25" | "30" | "35" | "40" | "45" | "all";
  yearFilter?: number;
}) {
  const result = await getLoyaltyAwardEligibilityReport({
    officeId,
    milestone,
    yearFilter,
  });

  if (result.data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Award className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No employees eligible for loyalty awards in the selected period.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get milestone badge color
  const getMilestoneColor = (milestone: number) => {
    if (milestone >= 40)
      return "bg-purple-100 text-purple-800 border-purple-200";
    if (milestone >= 30) return "bg-blue-100 text-blue-800 border-blue-200";
    if (milestone >= 20) return "bg-green-100 text-green-800 border-green-200";
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  };

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Date Hired</TableHead>
              <TableHead>Years of Service</TableHead>
              <TableHead>Milestone</TableHead>
              <TableHead>Eligible Year</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.map((record) => (
              <TableRow key={`${record.id}-${record.milestone}`}>
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
                <TableCell>
                  {new Date(record.dateHired).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell>{record.yearsOfService} years</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={getMilestoneColor(record.milestone)}
                  >
                    {record.milestone} Years
                  </Badge>
                </TableCell>
                <TableCell>
                  {record.eligibleYear === new Date().getFullYear() ? (
                    <span className="text-green-600 font-medium">
                      This Year
                    </span>
                  ) : (
                    record.eligibleYear
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
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);

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
          <label htmlFor="milestone" className="text-sm font-medium mb-2 block">
            Milestone
          </label>
          <Select name="milestone" defaultValue="all">
            <SelectTrigger id="milestone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Milestones</SelectItem>
              <SelectItem value="10">10 Years</SelectItem>
              <SelectItem value="15">15 Years</SelectItem>
              <SelectItem value="20">20 Years</SelectItem>
              <SelectItem value="25">25 Years</SelectItem>
              <SelectItem value="30">30 Years</SelectItem>
              <SelectItem value="35">35 Years</SelectItem>
              <SelectItem value="40">40 Years</SelectItem>
              <SelectItem value="45">45 Years</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="year" className="text-sm font-medium mb-2 block">
            Award Year
          </label>
          <Select name="year" defaultValue={currentYear.toString()}>
            <SelectTrigger id="year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function LoyaltyReportPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const officeId =
    typeof params.office === "string" && params.office !== "all"
      ? params.office
      : undefined;

  const milestone = (
    typeof params.milestone === "string" &&
    ["10", "15", "20", "25", "30", "35", "40", "45", "all"].includes(
      params.milestone,
    )
      ? params.milestone
      : "all"
  ) as "10" | "15" | "20" | "25" | "30" | "35" | "40" | "45" | "all";

  const yearFilter =
    typeof params.year === "string"
      ? parseInt(params.year, 10)
      : new Date().getFullYear();

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-pcso-navy">
            Loyalty Award Eligibility Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Employees eligible for 10/15/20/25/30/35/40/45 year service awards
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export Excel
        </Button>
      </header>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>10-15 Year Milestones</CardDescription>
            <CardTitle className="text-2xl">0</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>20-25 Year Milestones</CardDescription>
            <CardTitle className="text-2xl">0</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>30-35 Year Milestones</CardDescription>
            <CardTitle className="text-2xl">0</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>40+ Year Milestones</CardDescription>
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
        <LoyaltyReportTable
          officeId={officeId}
          milestone={milestone}
          yearFilter={yearFilter}
        />
      </Suspense>
    </div>
  );
}
