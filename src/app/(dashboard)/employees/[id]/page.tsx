import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FileText, Pencil } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvatarUploader } from "@/components/employees/avatar-uploader";
import {
  TwoOhOneViewer,
  type StoredDocument,
} from "@/components/employees/201-viewer";
import { EmployeeDocumentList } from "@/components/pimm/employee-document-list";
import { listEmployeeDocuments } from "@/lib/actions/pimm/employee-documents";
import { ArchiveEmployeeButton } from "@/components/employees/archive-employee-button";
import { getEmployeeById } from "../queries";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/constants/appointment-types";
import { requireAuth } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { maskEmployeeSensitiveFields } from "@/lib/utils/masking";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getEmployeeById(id);
  if (!employee) return { title: "Employee Not Found" };
  return {
    title: `${employee.firstName} ${employee.lastName} — Profile`,
  };
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "MMMM d, yyyy");
  } catch {
    return dateStr;
  }
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="col-span-2 font-medium">{value ?? "—"}</span>
    </div>
  );
}

function getStatusVariant(
  status: string,
): "success" | "warning" | "destructive" | "muted" {
  switch (status) {
    case "active":
      return "success";
    case "on_leave":
    case "suspended":
      return "warning";
    case "resigned":
    case "terminated":
    case "deceased":
      return "destructive";
    default:
      return "muted";
  }
}

const VIEWER_DOC_TYPES: Record<string, StoredDocument["type"]> = {
  "201_FILE": "201_file",
  APPOINTMENT_PAPER: "appointment_paper",
  MEDICAL_CERTIFICATE: "medical_certificate",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployeeProfilePage({ params }: PageProps) {
  const { id } = await params;
  const [user, employee] = await Promise.all([
    requireAuth(),
    getEmployeeById(id),
  ]);

  if (!employee) notFound();

  const canEdit = hasPermission(user.role, "employees", "edit");
  const canArchive = hasPermission(user.role, "employees", "delete");
  const canApproveDocs = hasPermission(user.role, "employees", "approve");

  // H-20: real 201 documents (private bucket, signed after authorization).
  const docsResult = await listEmployeeDocuments({ employeeId: employee.id });
  const documents = "error" in docsResult ? [] : docsResult.data;
  const approvedDocs: StoredDocument[] = documents
    .filter((d) => d.status === "approved")
    .map((d) => ({
      name: d.fileName,
      type: VIEWER_DOC_TYPES[d.documentTypeCode] ?? "other",
      storagePath: d.id,
      uploadedAt: new Date(d.uploadedAt).toISOString(),
      signedUrl: d.fileUrl || undefined,
    }));
  const reviewDocs = documents.filter((d) => d.status !== "approved");

  // TOR 3.2.8: viewers WITHOUT employees.edit (payroll_admin, supervisor,
  // executive, auditor, viewer) see masked government IDs. Display-only —
  // official documents and HR edit surfaces stay unmasked.
  const displayIds = maskEmployeeSensitiveFields(
    {
      tin: employee.tin,
      gsisNo: employee.gsisNo,
      philhealthNo: employee.philhealthNo,
      pagibigNo: employee.pagibigNo,
    },
    canEdit,
  );

  const fullName = [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");
  const displayName = employee.suffix
    ? `${fullName}, ${employee.suffix}`
    : fullName;

  const appointmentLabel =
    APPOINTMENT_TYPE_LABELS[
      employee.appointmentType as keyof typeof APPOINTMENT_TYPE_LABELS
    ] ?? employee.appointmentType;

  const statusLabel = employee.status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <Link
          href="/employees"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-pcso-navy"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Employees
        </Link>
      </nav>

      {/* Profile header card */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="h-28 rounded-t-xl bg-gradient-to-r from-pcso-navy to-pcso-navy-light" />
        <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
          {/* Avatar */}
          <div className="-mt-12">
            <AvatarUploader
              employeeId={employee.id}
              displayName={displayName}
              currentAvatarUrl={null}
            />
          </div>

          {/* Name + meta */}
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between pb-0.5">
            <div>
              <h1 className="font-serif text-2xl font-bold text-pcso-navy">
                {displayName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {employee.positionTitle}
              </p>
              <p className="text-xs text-muted-foreground">
                {employee.officeName ?? ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusVariant(employee.status)}>
                {statusLabel}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {employee.employeeNo}
              </span>
              {canEdit && (
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <Link href={`/employees/${employee.id}/edit`}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </Button>
              )}
              {canArchive && (
                <ArchiveEmployeeButton
                  employeeId={employee.id}
                  employeeName={displayName}
                  isAlreadyArchived={employee.status === "resigned"}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="bg-pcso-navy/5">
            <TabsTrigger
              value="profile"
              className="data-[state=active]:bg-pcso-navy data-[state=active]:text-white"
            >
              Profile
            </TabsTrigger>
            <TabsTrigger
              value="employment"
              className="data-[state=active]:bg-pcso-navy data-[state=active]:text-white"
            >
              Employment History
            </TabsTrigger>
            <TabsTrigger
              value="leave"
              className="data-[state=active]:bg-pcso-navy data-[state=active]:text-white"
            >
              Leave Credits
            </TabsTrigger>
            <TabsTrigger
              value="payroll"
              className="data-[state=active]:bg-pcso-navy data-[state=active]:text-white"
            >
              Payroll History
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className="data-[state=active]:bg-pcso-navy data-[state=active]:text-white"
            >
              Documents
            </TabsTrigger>
          </TabsList>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href={`/employees/${employee.id}/201`}>
              <FileText className="h-3.5 w-3.5" />
              201 File / PDS Data
            </Link>
          </Button>
        </div>

        {/* Profile tab */}
        <TabsContent value="profile">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Personal info */}
            <section className="rounded-lg border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pcso-navy">
                Personal Information
              </h2>
              <div className="divide-y divide-border">
                <InfoRow
                  label="Date of Birth"
                  value={formatDate(employee.birthDate)}
                />
                <InfoRow
                  label="Gender"
                  value={employee.gender
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                />
                <InfoRow
                  label="Civil Status"
                  value={employee.civilStatus
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                />
                <InfoRow label="Nationality" value={employee.nationality} />
                <InfoRow label="Religion" value={employee.religion} />
                <InfoRow label="Blood Type" value={employee.bloodType} />
                <InfoRow label="Email" value={employee.email} />
                <InfoRow label="Phone" value={employee.phone} />
              </div>
            </section>

            {/* Employment info */}
            <section className="rounded-lg border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pcso-navy">
                Employment Details
              </h2>
              <div className="divide-y divide-border">
                <InfoRow label="Appointment Type" value={appointmentLabel} />
                <InfoRow
                  label="Salary Grade / Step"
                  value={`SG-${employee.salaryGrade} / Step ${employee.step}`}
                />
                <InfoRow label="Office" value={employee.officeName} />
                <InfoRow
                  label="Date Hired"
                  value={formatDate(employee.dateHired)}
                />
                <InfoRow
                  label="Date Regularized"
                  value={formatDate(employee.dateRegularized)}
                />
              </div>
            </section>

            {/* Government IDs */}
            <section className="rounded-lg border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pcso-navy">
                Government IDs
              </h2>
              <div className="divide-y divide-border">
                <InfoRow label="TIN" value={displayIds.tin} />
                <InfoRow label="GSIS No." value={displayIds.gsisNo} />
                <InfoRow
                  label="PhilHealth No."
                  value={displayIds.philhealthNo}
                />
                <InfoRow label="Pag-IBIG No." value={displayIds.pagibigNo} />
              </div>
              {!canEdit && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Identifiers are partially masked for your role (TOR 3.2.8).
                </p>
              )}
            </section>

            {/* Address & emergency */}
            <section className="rounded-lg border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pcso-navy">
                Address & Emergency Contact
              </h2>
              <div className="divide-y divide-border">
                <InfoRow
                  label="Current Address"
                  value={
                    [
                      employee.addressStreet,
                      employee.addressBarangay,
                      employee.addressCity,
                      employee.addressProvince,
                      employee.addressZipCode,
                    ]
                      .filter(Boolean)
                      .join(", ") || null
                  }
                />
                <InfoRow
                  label="Emergency Contact"
                  value={employee.emergencyContactName}
                />
                <InfoRow
                  label="Relationship"
                  value={employee.emergencyContactRelationship}
                />
                <InfoRow
                  label="Emergency Phone"
                  value={employee.emergencyContactPhone}
                />
              </div>
            </section>
          </div>
        </TabsContent>

        {/* Employment history tab — placeholder for Phase 06+ */}
        <TabsContent value="employment">
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            <p className="text-sm">
              Employment history tracking is coming in a future phase.
            </p>
          </div>
        </TabsContent>

        {/* Leave credits tab — placeholder for Phase 07 */}
        <TabsContent value="leave">
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            <p className="text-sm">
              Leave credits will be available after the Leave module is set up.
            </p>
          </div>
        </TabsContent>

        {/* Payroll history tab — links to payroll module */}
        <TabsContent value="payroll">
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            <p className="text-sm">
              View this employee&apos;s payslips in the{" "}
              <Link
                href="/payroll"
                className="text-pcso-navy underline hover:text-pcso-gold"
              >
                Payroll
              </Link>{" "}
              module.
            </p>
          </div>
        </TabsContent>

        {/* Documents tab */}
        <TabsContent value="documents">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-pcso-navy">
                201 File Documents
              </h2>
              {canEdit && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/employees/${employee.id}/edit#documents`}>
                    Upload Documents
                  </Link>
                </Button>
              )}
            </div>
            {"error" in docsResult && (
              <p className="text-sm text-destructive">{docsResult.error}</p>
            )}
            <TwoOhOneViewer documents={approvedDocs} />
            {/* PIM-004: staged uploads await HR validation before commit. */}
            {canApproveDocs && reviewDocs.length > 0 && (
              <EmployeeDocumentList
                documents={reviewDocs}
                employeeId={employee.id}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
