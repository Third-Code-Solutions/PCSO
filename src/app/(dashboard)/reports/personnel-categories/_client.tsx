"use client";

/**
 * Personnel Categories report client — TOR 1.3.3.
 * Filters (office / category / status) → categorized listing + CSV export.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
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
import { getPersonnelCategoriesReport } from "@/lib/actions/reports/workforce-reports";
import { buildCsvFromTable } from "@/lib/utils/pimm/adhoc-report";
import { CsvExportButton } from "../_components/csv-export-button";

type CategoriesResult = Awaited<
  ReturnType<typeof getPersonnelCategoriesReport>
>;

interface PersonnelCategoriesClientProps {
  offices: Array<{ id: string; name: string }>;
}

export function PersonnelCategoriesClient({
  offices,
}: PersonnelCategoriesClientProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<CategoriesResult | null>(null);
  const [filters, setFilters] = useState({
    officeId: "",
    category: "all" as "organic" | "non_organic" | "all",
    status: "active" as "active" | "all",
  });

  function handleGenerate() {
    startTransition(async () => {
      try {
        const report = await getPersonnelCategoriesReport({
          officeId: filters.officeId || undefined,
          category: filters.category,
          status: filters.status,
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
          "Office",
          "Appointment Type",
          "Category",
          "Status",
          "Date Hired",
        ],
        result.data.map((r) => [
          r.employeeNo,
          r.fullName,
          r.position,
          r.office,
          r.appointmentTypeLabel,
          r.category,
          r.status,
          r.dateHired,
        ]),
      )
    : "";

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Customize the report parameters</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="office">Office</Label>
            <Select
              value={filters.officeId || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  officeId: value === "all" ? "" : value,
                })
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

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={filters.category}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  category: value as "organic" | "non_organic" | "all",
                })
              }
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="organic">Organic</SelectItem>
                <SelectItem value="non_organic">Non-Organic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Employment Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters({ ...filters, status: value as "active" | "all" })
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="all">All Statuses</SelectItem>
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
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Personnel</CardDescription>
                <CardTitle className="text-2xl">{result.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Organic</CardDescription>
                <CardTitle className="text-2xl">
                  {result.summary.organicTotal}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Non-Organic</CardDescription>
                <CardTitle className="text-2xl">
                  {result.summary.nonOrganicTotal}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Per appointment type breakdown */}
          <div className="flex flex-wrap gap-2">
            {result.summary.byAppointmentType.map((item) => (
              <Badge key={item.label} variant="outline">
                {item.label}: {item.count}
              </Badge>
            ))}
          </div>

          {/* Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Personnel Listing</CardTitle>
                <CardDescription>
                  {result.total} record{result.total === 1 ? "" : "s"} — organic
                  personnel listed first
                </CardDescription>
              </div>
              <CsvExportButton
                fileName="personnel-categories-report.csv"
                csv={csv}
              />
            </CardHeader>
            <CardContent className="p-0">
              {result.data.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">
                  No employees match the selected filters.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Office</TableHead>
                      <TableHead>Appointment Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date Hired</TableHead>
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
                        <TableCell>{record.appointmentTypeLabel}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              record.category === "Organic"
                                ? "bg-green-100 text-green-800 border-green-200"
                                : "bg-amber-100 text-amber-800 border-amber-200"
                            }
                          >
                            {record.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">
                          {record.status.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell>{record.dateHired}</TableCell>
                      </TableRow>
                    ))}
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
