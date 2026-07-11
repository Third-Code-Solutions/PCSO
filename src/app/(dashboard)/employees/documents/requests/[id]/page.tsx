/**
 * Document Request Detail Page
 * PRD PIM-005
 *
 * Shows full request details with state-specific action buttons.
 * State machine: Received → In Process → Ready → Released
 * Alternative paths: → On Hold, → Disapproved
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Download,
  User,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getDocumentRequestById } from "@/lib/actions/documents";
import { getActiveCertificateTemplates } from "@/lib/actions/documents/certificate-templates";
import { AcceptRequestForm } from "./accept-request-form";
import { ProcessRequestForm } from "./process-request-form";
import { HoldRequestForm } from "./hold-request-form";
import { ResumeRequestForm } from "./resume-request-form";
import { ReleaseRequestForm } from "./release-request-form";
import { DisapproveRequestForm } from "./disapprove-request-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Status badge configuration
const statusConfig = {
  received: {
    label: "Received",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: Clock,
  },
  in_process: {
    label: "In Process",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: FileText,
  },
  on_hold: {
    label: "On Hold",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    icon: Pause,
  },
  ready: {
    label: "Ready",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: CheckCircle,
  },
  released: {
    label: "Released",
    color: "bg-gray-100 text-gray-800 border-gray-200",
    icon: CheckCircle,
  },
  disapproved: {
    label: "Disapproved",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: XCircle,
  },
};

// Document type labels
const documentTypeLabels: Record<string, string> = {
  COE: "Certificate of Employment",
  COE_REMUNERATION: "COE with Remunerations",
  SERVICE_RECORD: "Service Record",
  PDS: "Personal Data Sheet",
  NOSI: "Notice of Salary Increment",
  NOSA: "Notice of Salary Adjustment",
  CLEARANCE: "Office Clearance",
  CERTIFICATE_TRAINING: "Training Certificate",
  AD_HOC: "Ad Hoc Certificate",
};

async function RequestDetailContent({ id }: { id: string }) {
  const result = await getDocumentRequestById(id);

  if (!result.success || !result.data) {
    notFound();
  }

  const request = result.data;
  const config = statusConfig[request.status as keyof typeof statusConfig];
  const StatusIcon = config.icon;

  // Ad hoc certificates require a template selection at processing time.
  const certificateTemplates =
    request.status === "in_process" && request.documentType === "AD_HOC"
      ? await getActiveCertificateTemplates()
      : [];

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/employees/documents/requests">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Requests
          </Link>
        </Button>
      </div>

      {/* Request Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="font-serif text-2xl text-pcso-navy">
                Document Request #{request.id.slice(0, 8)}
              </CardTitle>
              <CardDescription className="mt-1">
                Submitted on{" "}
                {new Date(request.receivedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </CardDescription>
            </div>
            <Badge variant="outline" className={config.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Request Details Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Employee</div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">
                    {request.employee.firstName}{" "}
                    {request.employee.middleName?.[0]}.{" "}
                    {request.employee.lastName}
                    {request.employee.suffix && ` ${request.employee.suffix}`}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {request.employee.employeeNo}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Document Type</div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="font-medium">
                  {documentTypeLabels[request.documentType] ||
                    request.documentType}
                </div>
              </div>
            </div>

            {request.purpose && (
              <div className="space-y-1 md:col-span-2">
                <div className="text-sm text-muted-foreground">Purpose</div>
                <div className="text-sm">{request.purpose}</div>
              </div>
            )}

            {request.remarks && (
              <div className="space-y-1 md:col-span-2">
                <div className="text-sm text-muted-foreground">Remarks</div>
                <div className="text-sm">{request.remarks}</div>
              </div>
            )}

            {request.assignedTo && (
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Assigned To</div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm font-medium">
                    {request.assignedTo.firstName} {request.assignedTo.lastName}
                  </div>
                </div>
              </div>
            )}

            {request.serialNumber && (
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">
                  Serial Number
                </div>
                <div className="font-mono text-sm font-medium">
                  {request.serialNumber}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Timeline */}
          <div>
            <h3 className="font-medium mb-4">Request Timeline</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  {request.processedAt && (
                    <div className="w-0.5 h-8 bg-gray-200" />
                  )}
                </div>
                <div className="flex-1 pb-8">
                  <div className="font-medium">Received</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(request.receivedAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>

              {request.processedAt && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-yellow-600" />
                    </div>
                    {request.readyAt && (
                      <div className="w-0.5 h-8 bg-gray-200" />
                    )}
                  </div>
                  <div className="flex-1 pb-8">
                    <div className="font-medium">In Process</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(request.processedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    {request.assignedTo && (
                      <div className="text-sm text-muted-foreground">
                        Assigned to {request.assignedTo.firstName}{" "}
                        {request.assignedTo.lastName}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {request.onHoldReason && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                      <Pause className="h-4 w-4 text-orange-600" />
                    </div>
                  </div>
                  <div className="flex-1 pb-8">
                    <div className="font-medium">On Hold</div>
                    <div className="text-sm text-muted-foreground">
                      {request.onHoldReason}
                    </div>
                  </div>
                </div>
              )}

              {request.readyAt && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    {request.releasedAt && (
                      <div className="w-0.5 h-8 bg-gray-200" />
                    )}
                  </div>
                  <div className="flex-1 pb-8">
                    <div className="font-medium">Ready</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(request.readyAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    {request.generatedDocumentUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        asChild
                      >
                        <a
                          href={request.generatedDocumentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Document
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {request.releasedAt && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-gray-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">Released</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(request.releasedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              )}

              {request.disapprovedAt && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                      <XCircle className="h-4 w-4 text-red-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">Disapproved</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(request.disapprovedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    {request.disapprovalReason && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Reason: {request.disapprovalReason}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Forms based on current status */}
      {request.status === "received" && (
        <div className="grid gap-4 md:grid-cols-2">
          <AcceptRequestForm requestId={request.id} />
          <DisapproveRequestForm requestId={request.id} />
        </div>
      )}

      {request.status === "in_process" && (
        <div className="grid gap-4 md:grid-cols-2">
          <ProcessRequestForm
            requestId={request.id}
            documentType={request.documentType}
            employeeId={request.employeeId}
            certificateTemplates={certificateTemplates}
          />
          <HoldRequestForm requestId={request.id} />
        </div>
      )}

      {request.status === "on_hold" && (
        <ResumeRequestForm requestId={request.id} />
      )}

      {request.status === "ready" && (
        <ReleaseRequestForm requestId={request.id} />
      )}
    </div>
  );
}

export default async function DocumentRequestDetailPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;

  return (
    <div className="space-y-6 p-6">
      <Suspense
        fallback={
          <div className="space-y-6">
            <Card className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-32 bg-gray-200 rounded" />
              </div>
            </Card>
          </div>
        }
      >
        <RequestDetailContent id={id} />
      </Suspense>
    </div>
  );
}
