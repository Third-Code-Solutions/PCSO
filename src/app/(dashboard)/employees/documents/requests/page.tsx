/**
 * Document Requests List Page
 * PRD PIM-005 — Employee Portal: Online document certification request queue
 *
 * Displays all document requests with status tracking:
 * - Received → In Process → Ready → Released (success path)
 * - Received → Disapproved (rejection path)
 * - In Process → On Hold → In Process (hold/resume cycle)
 */

import { Suspense } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
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
import { getDocumentRequests } from "@/lib/actions/documents/document-request-actions";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { requireAuth } from "@/lib/auth/guards";

export const metadata = {
  title: "Document Requests",
  description: "View and manage employee document requests.",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[]>>;
}

// Status badge colors
const statusColors: Record<string, string> = {
  received: "bg-blue-100 text-blue-800 border-blue-200",
  in_process: "bg-yellow-100 text-yellow-800 border-yellow-200",
  on_hold: "bg-orange-100 text-orange-800 border-orange-200",
  ready: "bg-green-100 text-green-800 border-green-200",
  released: "bg-gray-100 text-gray-800 border-gray-200",
  disapproved: "bg-red-100 text-red-800 border-red-200",
};

const statusLabels: Record<string, string> = {
  received: "Received",
  in_process: "In Process",
  on_hold: "On Hold",
  ready: "Ready",
  released: "Released",
  disapproved: "Disapproved",
};

const documentTypeLabels: Record<string, string> = {
  COE: "Certificate of Employment",
  COE_REMUNERATION: "COE with Remunerations",
  SERVICE_RECORD: "Service Record",
  PDS: "Personal Data Sheet",
  NOSI: "Notice of Salary Step Increment",
  NOSA: "Notice of Salary Adjustment",
  CLEARANCE: "Office Clearance",
  CERTIFICATE_TRAINING: "Certificate of Training",
  AD_HOC: "Ad Hoc Certificate",
};

async function DocumentRequestsTable() {
  const result = await getDocumentRequests({ limit: 100 });

  if (result.data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No document requests found.
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
              <TableHead>Document Type</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {request.employee.firstName} {request.employee.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {request.employee.employeeNo}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {documentTypeLabels[request.documentType] ||
                    request.documentType}
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {request.purpose || "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={statusColors[request.status]}
                  >
                    {statusLabels[request.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {request.assignedTo
                    ? `${request.assignedTo.firstName} ${request.assignedTo.lastName}`
                    : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(request.receivedAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/employees/documents/requests/${request.id}`}>
                      View
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default async function DocumentRequestsPage({
  searchParams,
}: PageProps) {
  await requireAuth();
  return (
    <div className="space-y-6 p-6">
      {/* Realtime subscription */}
      <RealtimeBoundary tables={["document_requests"]} />

      {/* Page header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-pcso-navy">
            Document Requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage employee document certification requests
          </p>
        </div>
        <Button
          asChild
          size="sm"
          className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
        >
          <Link href="/employees/documents/requests/new">
            <Plus className="h-4 w-4" />
            New Request
          </Link>
        </Button>
      </header>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Received</CardDescription>
            <CardTitle className="text-2xl">0</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In Process</CardDescription>
            <CardTitle className="text-2xl">0</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ready</CardDescription>
            <CardTitle className="text-2xl">0</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed (This Month)</CardDescription>
            <CardTitle className="text-2xl">0</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Requests Table */}
      <Suspense fallback={<Card className="p-6">Loading requests...</Card>}>
        <DocumentRequestsTable />
      </Suspense>
    </div>
  );
}
