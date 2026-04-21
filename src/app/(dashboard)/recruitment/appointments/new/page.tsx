import type { Metadata } from "next";
import { PageHeader } from "@/components/layouts/page-header";
import { RoleGate } from "@/components/role-gate";
import {
  AppointmentForm,
  type ShortlistedApplicantOption,
} from "@/components/recruitment/appointment-form";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { listApplications } from "@/lib/actions/rpm/applicants";
import { issueAppointment } from "@/lib/actions/rpm/appointment";
import { unwrap } from "@/components/recruitment/_result";

export const metadata: Metadata = {
  title: "Issue Appointment",
};

interface ShortlistedRow {
  id: string;
  vacancyId: string;
  applicantFirstName?: string | null;
  applicantLastName?: string | null;
  applicantName?: string;
  vacancyTitle?: string;
}

type IssueActionResult =
  | {
      ok: true;
      data: { employeeId: string; pdfUrls?: { label: string; href: string }[] };
    }
  | { ok: false; error: string };

async function issueAppointmentAdapter(
  input: unknown,
): Promise<IssueActionResult> {
  "use server";
  try {
    const result = (await issueAppointment(input)) as {
      employeeId?: string;
      pdfUrls?: { label: string; href: string }[];
    };
    return {
      ok: true,
      data: {
        employeeId: result?.employeeId ?? "",
        pdfUrls: result?.pdfUrls,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to issue appointment",
    };
  }
}

export default async function NewAppointmentPage() {
  const [user, shortlistResult] = await Promise.all([
    getCurrentUser(),
    listApplications({ status: "shortlisted", perPage: 100 }).catch(() => null),
  ]);

  const role = user?.role ?? "employee_self_service";
  const issuerEmployeeId = user?.employeeId ?? "";

  const shortlistData = unwrap<{ rows?: ShortlistedRow[] } | ShortlistedRow[]>(
    shortlistResult,
  );
  const rows: ShortlistedRow[] = Array.isArray(shortlistData)
    ? shortlistData
    : (shortlistData?.rows ?? []);

  const shortlisted: ShortlistedApplicantOption[] = rows.map((r) => ({
    applicationId: r.id,
    vacancyId: r.vacancyId,
    applicantName:
      r.applicantName ??
      ([r.applicantFirstName, r.applicantLastName].filter(Boolean).join(" ") ||
        "Applicant"),
    position: r.vacancyTitle ?? "Position",
  }));

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Issue Appointment"
        description="Finalise the appointment and onboard the new employee."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "Appointments", href: "/recruitment/appointments" },
          { label: "New" },
        ]}
      />

      <RoleGate role={role} roles={["super_admin", "hr_admin"]}>
        <AppointmentForm
          shortlisted={shortlisted}
          issuerEmployeeId={issuerEmployeeId}
          issueAction={issueAppointmentAdapter}
        />
      </RoleGate>
    </div>
  );
}
