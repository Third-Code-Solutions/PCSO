import Link from "next/link";
import { format } from "date-fns";
import { ShieldAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth/guards";
import { getEmployeeById } from "@/app/(dashboard)/employees/queries";
import { getLeaveCreditBalance } from "@/app/(dashboard)/leave/queries";
import { TwoOhOneViewer } from "@/components/employees/201-viewer";
import type { StoredDocument } from "@/components/employees/201-viewer";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { createServerClient } from "@/lib/supabase/server";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/constants/appointment-types";
import { EditContactDialog, CopyButton } from "./_client";

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata = { title: "My Profile" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "MMMM d, yyyy");
  } catch {
    return dateStr;
  }
}

function capitalize(str: string): string {
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function InfoRow({
  label,
  value,
  suffix,
}: {
  label: string;
  value: React.ReactNode;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="col-span-2 flex items-center font-medium">
        {value ?? "—"}
        {suffix}
      </span>
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-pcso-navy">
          {title}
        </h2>
        {action}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
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

// ─── Storage — list employee 201 documents ────────────────────────────────────

async function listEmployeeDocuments(
  employeeId: string,
): Promise<StoredDocument[]> {
  const supabase = await createServerClient();
  const prefix = `${employeeId}/`;

  const { data, error } = await supabase.storage
    .from("employee-documents")
    .list(employeeId, { sortBy: { column: "created_at", order: "desc" } });

  if (error || !data) return [];

  return data
    .filter((f) => f.name !== ".emptyFolderPlaceholder")
    .map((f) => {
      const name = f.name;
      const lowerName = name.toLowerCase();
      let type: StoredDocument["type"] = "other";
      if (lowerName.includes("201")) type = "201_file";
      else if (lowerName.includes("appointment")) type = "appointment_paper";
      else if (lowerName.includes("medical")) type = "medical_certificate";

      return {
        name,
        type,
        storagePath: `${prefix}${name}`,
        uploadedAt: f.created_at ?? undefined,
      };
    });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfilePage() {
  const user = await requireAuth();
  const currentYear = new Date().getFullYear();

  // ── No employee record linked ──────────────────────────────────────────────
  if (!user.employeeId) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-xl border bg-card p-10 text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h1 className="mb-2 font-serif text-xl font-bold text-pcso-navy">
            No Employee Record Linked
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Your account ({user.email}) is an administrative account not linked
            to an employee record. Personal profile details are not available.
          </p>
          <Button
            asChild
            className="bg-pcso-navy text-white hover:bg-pcso-navy-light"
          >
            <Link href="/admin">Go to Admin Panel</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Fetch employee data in parallel ───────────────────────────────────────
  const [employee, leaveBalance, documents] = await Promise.all([
    getEmployeeById(user.employeeId),
    getLeaveCreditBalance(user.employeeId, currentYear),
    listEmployeeDocuments(user.employeeId),
  ]);

  if (!employee) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-xl border bg-card p-10 text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h1 className="mb-2 font-serif text-xl font-bold text-pcso-navy">
            Employee Record Not Found
          </h1>
          <p className="text-sm text-muted-foreground">
            Your account is linked to an employee ID that no longer exists.
            Contact HR to resolve this.
          </p>
        </div>
      </div>
    );
  }

  // ── Derived display values ────────────────────────────────────────────────
  const fullName = [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");
  const displayName = employee.suffix
    ? `${fullName}, ${employee.suffix}`
    : fullName;

  const addressParts = [
    employee.addressStreet,
    employee.addressBarangay,
    employee.addressCity,
    employee.addressProvince,
    employee.addressZipCode,
  ].filter(Boolean);
  const formattedAddress =
    addressParts.length > 0 ? addressParts.join(", ") : null;

  const appointmentLabel =
    APPOINTMENT_TYPE_LABELS[
      employee.appointmentType as keyof typeof APPOINTMENT_TYPE_LABELS
    ] ?? employee.appointmentType;

  const statusLabel = capitalize(employee.status);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <RealtimeBoundary tables={["employees", "leave_credits"] as const} />

      {/* ── Profile header ───────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="h-28 rounded-t-xl bg-gradient-to-r from-pcso-navy to-pcso-navy-light" />
        <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
          {/* Avatar placeholder — same dimensions as AvatarUploader */}
          <div className="-mt-12 flex h-24 w-24 items-center justify-center rounded-full border-4 border-background bg-pcso-navy/10 text-2xl font-bold text-pcso-navy shadow-sm">
            {employee.firstName[0]}
            {employee.lastName[0]}
          </div>

          <div className="flex flex-1 flex-col gap-2 pb-0.5 sm:flex-row sm:items-end sm:justify-between">
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
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="personal">
        <TabsList className="flex-wrap bg-pcso-navy/5">
          {(
            [
              { value: "personal", label: "Personal Info" },
              { value: "employment", label: "Employment" },
              { value: "govids", label: "Government IDs" },
              { value: "leave", label: "Leave Balances" },
              { value: "documents", label: "Documents" },
            ] as const
          ).map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="data-[state=active]:bg-pcso-navy data-[state=active]:text-white"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Tab 1: Personal Info ───────────────────────────────────────── */}
        <TabsContent value="personal">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard title="Personal Information">
              <InfoRow label="First Name" value={employee.firstName} />
              {employee.middleName && (
                <InfoRow label="Middle Name" value={employee.middleName} />
              )}
              <InfoRow label="Last Name" value={employee.lastName} />
              {employee.suffix && (
                <InfoRow label="Suffix" value={employee.suffix} />
              )}
              <InfoRow
                label="Date of Birth"
                value={formatDate(employee.birthDate)}
              />
              <InfoRow label="Gender" value={capitalize(employee.gender)} />
              <InfoRow
                label="Civil Status"
                value={capitalize(employee.civilStatus)}
              />
              <InfoRow label="Nationality" value={employee.nationality} />
              {employee.religion && (
                <InfoRow label="Religion" value={employee.religion} />
              )}
              {employee.bloodType && (
                <InfoRow label="Blood Type" value={employee.bloodType} />
              )}
              <InfoRow label="Email" value={employee.email} />
            </SectionCard>

            <SectionCard
              title="Contact & Address"
              action={
                <EditContactDialog
                  initial={{
                    phone: employee.phone,
                    addressStreet: employee.addressStreet,
                    addressBarangay: employee.addressBarangay,
                    addressCity: employee.addressCity,
                    addressProvince: employee.addressProvince,
                    addressZipCode: employee.addressZipCode,
                    emergencyContactName: employee.emergencyContactName,
                    emergencyContactRelationship:
                      employee.emergencyContactRelationship,
                    emergencyContactPhone: employee.emergencyContactPhone,
                  }}
                />
              }
            >
              <InfoRow label="Phone" value={employee.phone} />
              <InfoRow label="Current Address" value={formattedAddress} />
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
            </SectionCard>
          </div>
        </TabsContent>

        {/* ── Tab 2: Employment ─────────────────────────────────────────── */}
        <TabsContent value="employment">
          <SectionCard title="Employment Details">
            <InfoRow label="Employee No." value={employee.employeeNo} />
            <InfoRow label="Position Title" value={employee.positionTitle} />
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
            {employee.dateRegularized && (
              <InfoRow
                label="Date Regularized"
                value={formatDate(employee.dateRegularized)}
              />
            )}
            <InfoRow label="Status" value={statusLabel} />
          </SectionCard>
          <p className="mt-3 text-xs text-muted-foreground">
            Employment details are managed by HR. Contact your HR administrator
            for corrections.
          </p>
        </TabsContent>

        {/* ── Tab 3: Government IDs ─────────────────────────────────────── */}
        <TabsContent value="govids">
          <SectionCard title="Government IDs">
            <InfoRow
              label="TIN"
              value={employee.tin}
              suffix={<CopyButton value={employee.tin} label="TIN" />}
            />
            <InfoRow
              label="GSIS No."
              value={employee.gsisNo}
              suffix={
                <CopyButton value={employee.gsisNo} label="GSIS number" />
              }
            />
            <InfoRow
              label="PhilHealth No."
              value={employee.philhealthNo}
              suffix={
                <CopyButton
                  value={employee.philhealthNo}
                  label="PhilHealth number"
                />
              }
            />
            <InfoRow
              label="Pag-IBIG No."
              value={employee.pagibigNo}
              suffix={
                <CopyButton
                  value={employee.pagibigNo}
                  label="Pag-IBIG number"
                />
              }
            />
          </SectionCard>
          <p className="mt-3 text-xs text-muted-foreground">
            Government IDs are read-only. Contact HR to update these numbers.
          </p>
        </TabsContent>

        {/* ── Tab 4: Leave Balances ─────────────────────────────────────── */}
        <TabsContent value="leave">
          <SectionCard title={`Leave Balances — ${currentYear}`}>
            {leaveBalance ? (
              <>
                <InfoRow
                  label="Vacation Leave (VL)"
                  value={
                    <span className="font-mono">
                      {leaveBalance.vlBalance.toFixed(4)}{" "}
                      <span className="font-sans text-xs text-muted-foreground">
                        days
                      </span>
                    </span>
                  }
                />
                <InfoRow
                  label="  VL Earned"
                  value={
                    <span className="font-mono text-muted-foreground">
                      {leaveBalance.vlEarned.toFixed(4)}
                    </span>
                  }
                />
                <InfoRow
                  label="  VL Carry-over"
                  value={
                    <span className="font-mono text-muted-foreground">
                      {leaveBalance.vlCarryOver.toFixed(4)}
                    </span>
                  }
                />
                <InfoRow
                  label="Sick Leave (SL)"
                  value={
                    <span className="font-mono">
                      {leaveBalance.slBalance.toFixed(4)}{" "}
                      <span className="font-sans text-xs text-muted-foreground">
                        days
                      </span>
                    </span>
                  }
                />
                <InfoRow
                  label="  SL Earned"
                  value={
                    <span className="font-mono text-muted-foreground">
                      {leaveBalance.slEarned.toFixed(4)}
                    </span>
                  }
                />
                <InfoRow
                  label="  SL Carry-over"
                  value={
                    <span className="font-mono text-muted-foreground">
                      {leaveBalance.slCarryOver.toFixed(4)}
                    </span>
                  }
                />
                {leaveBalance.vlForfeited > 0 && (
                  <InfoRow
                    label="VL Forfeited"
                    value={
                      <span className="font-mono text-destructive">
                        {leaveBalance.vlForfeited.toFixed(4)}
                      </span>
                    }
                  />
                )}
              </>
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Leave balance data is not yet available for {currentYear}.
                Contact HR to set up your leave credits.
              </div>
            )}
          </SectionCard>
          <p className="mt-3 text-xs text-muted-foreground">
            Balances accrue at 1.25 days per month per CSC Omnibus Rules. VL
            carry-over is capped at 10 days per year; SL carry-over is
            unlimited.
          </p>
        </TabsContent>

        {/* ── Tab 5: Documents ──────────────────────────────────────────── */}
        <TabsContent value="documents">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-pcso-navy">
                201 File Documents
              </h2>
            </div>
            <TwoOhOneViewer documents={documents} />
            <p className="text-xs text-muted-foreground">
              Documents are read-only. Contact HR to add or remove files from
              your 201 file.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
