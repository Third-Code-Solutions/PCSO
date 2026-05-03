/**
 * /saln/new — File a New SALN
 *
 * Renders the multi-section SALN form for the authenticated employee.
 * Employee info is auto-filled from the session.
 *
 * Guards:
 *  - Self-service users may only file their own SALN (enforced by fileSaln).
 *  - If an existing non-draft submission already exists for the same
 *    (employee, year, filingType), we short-circuit with a friendly message
 *    offering a link to edit the existing record. This prevents the unique
 *    index collision (saln_submissions_employee_year_type_idx, SQLSTATE 23505)
 *    from bubbling up as an opaque 500 error.
 *  - The server action still wraps the insert in a try/catch so a lost race
 *    against a concurrent submit returns a friendly error rather than crashing.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { AlertTriangle, Pencil } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { employees, offices, salnSubmissions } from "@/lib/db/schema";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { SalnForm } from "@/components/saln/saln-form";
import { fileSaln } from "@/app/(dashboard)/saln/actions";
import { currentCoverageYear } from "@/lib/utils/saln/deadline";
import type { EmployeeInfo } from "@/components/saln/saln-form";
import type {
  FilingType,
  FileSalnInput,
  SalnStatus,
} from "@/lib/validations/saln";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface NewSalnPageProps {
  searchParams: Promise<{
    type?: string;
    year?: string;
  }>;
}

interface ExistingSubmission {
  id: string;
  status: SalnStatus;
}

const VALID_FILING_TYPES: ReadonlyArray<FilingType> = [
  "annual",
  "initial",
  "upon_assumption",
  "upon_separation",
];

const FILING_TYPE_LABELS: Record<FilingType, string> = {
  annual: "Annual",
  initial: "Initial",
  upon_assumption: "Upon Assumption of Office",
  upon_separation: "Upon Separation from Service",
};

/**
 * Find any existing submission that would collide with a new insert against
 * the (employee_id, year, filing_type) unique index. Drafts are returned too
 * so we can guide the user to resume, rather than silently blocking them.
 *
 * Uses the Drizzle `db` (service-role) client so RLS does not interfere.
 */
async function findExistingSubmission(
  employeeId: string,
  year: number,
  filingType: FilingType,
): Promise<ExistingSubmission | null> {
  const [row] = await db
    .select({ id: salnSubmissions.id, status: salnSubmissions.status })
    .from(salnSubmissions)
    .where(
      and(
        eq(salnSubmissions.employeeId, employeeId),
        eq(salnSubmissions.year, year),
        eq(
          salnSubmissions.filingType,
          filingType as
            | "annual"
            | "initial"
            | "upon_assumption"
            | "upon_separation",
        ),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    id: String(row.id),
    status: (row.status as SalnStatus) ?? "draft",
  };
}

export default async function NewSalnPage({ searchParams }: NewSalnPageProps) {
  const user = await requirePermission("saln", "create");

  if (!user.employeeId) {
    redirect("/dashboard");
  }

  const resolvedParams = await searchParams;

  // Resolve filing type from query param; default to annual
  const rawType = resolvedParams.type ?? "annual";
  const filingType: FilingType = VALID_FILING_TYPES.includes(
    rawType as FilingType,
  )
    ? (rawType as FilingType)
    : "annual";

  // Coverage year — query param or computed default
  const coverageYear = resolvedParams.year
    ? parseInt(resolvedParams.year, 10)
    : currentCoverageYear();

  // Load employee info via Drizzle (service-role) to bypass RLS
  const [empRow] = await db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      middleName: employees.middleName,
      lastName: employees.lastName,
      positionTitle: employees.positionTitle,
      email: employees.email,
      dateHired: employees.dateHired,
      officeName: offices.name,
    })
    .from(employees)
    .leftJoin(offices, eq(employees.officeId, offices.id))
    .where(eq(employees.id, user.employeeId))
    .limit(1);

  if (!empRow) {
    redirect("/saln");
  }

  const fullName = [empRow.firstName, empRow.middleName, empRow.lastName]
    .filter(Boolean)
    .join(" ");

  const employee: EmployeeInfo = {
    id: empRow.id,
    employeeNo: empRow.employeeNo,
    fullName,
    positionTitle: empRow.positionTitle,
    officeName: empRow.officeName ?? null,
    email: empRow.email ?? null,
    dateHired: empRow.dateHired,
  };

  // ── Duplicate-submission guard ──────────────────────────────────────────
  const existing = await findExistingSubmission(
    user.employeeId,
    coverageYear,
    filingType,
  );

  if (existing) {
    return (
      <div>
        <PageHeader
          title="File New SALN"
          description={`Statement of Assets, Liabilities, and Net Worth — ${coverageYear}`}
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "My SALN", href: "/saln" },
            { label: "File New SALN" },
          ]}
        />

        <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-amber-300 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
              aria-hidden
            />
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-amber-900">
                  You already have a SALN on file for this coverage year
                </h2>
                <p className="mt-1 text-sm text-amber-800">
                  Only one {FILING_TYPE_LABELS[filingType]} SALN per coverage
                  year is allowed. Your current submission has status{" "}
                  <span className="font-semibold">
                    {existing.status.replace(/_/g, " ")}
                  </span>
                  .
                  {existing.status === "draft"
                    ? " You can continue editing the existing draft."
                    : existing.status === "deficient"
                      ? " Please open it to review HR remarks and re-submit."
                      : " If corrections are required, contact the compliance office."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  asChild
                  size="sm"
                  className="bg-pcso-navy text-white hover:bg-pcso-navy-light"
                >
                  <Link href={`/saln/${existing.id}`}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Open existing submission
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/saln">Back to My SALN</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="File New SALN"
        description={`Statement of Assets, Liabilities, and Net Worth — ${coverageYear}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My SALN", href: "/saln" },
          { label: "File New SALN" },
        ]}
      />

      <div className="mb-6 rounded-md border border-pcso-gold/40 bg-pcso-cream p-4">
        <p className="text-sm font-medium text-pcso-navy">
          Important Notice — RA 6713
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          All statements in this SALN must be true and accurate. Falsification
          is a ground for disciplinary action and criminal prosecution under
          Section 11 of Republic Act No. 6713. All information is encrypted and
          access-controlled.
        </p>
      </div>

      <SalnForm
        employee={employee}
        year={coverageYear}
        filingType={filingType}
        onSaveDraft={async (data: FileSalnInput) => {
          "use server";
          try {
            return await fileSaln({ ...data, submit: false });
          } catch (err) {
            throw rewriteDuplicateError(err);
          }
        }}
        onSubmit={async (data: FileSalnInput) => {
          "use server";
          try {
            return await fileSaln({ ...data, submit: true });
          } catch (err) {
            throw rewriteDuplicateError(err);
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper — translate PostgreSQL unique-violation (SQLSTATE 23505) into a
// human-readable error. Runs inline inside the server action bodies so no
// extra server-function entrypoint is registered.
// ---------------------------------------------------------------------------

function rewriteDuplicateError(err: unknown): Error {
  const message = err instanceof Error ? err.message : "Failed to file SALN.";
  if (/23505|duplicate key|already exists/i.test(message)) {
    return new Error(
      "A SALN for this coverage year and filing type already exists. Return to My SALN to edit it.",
    );
  }
  return err instanceof Error ? err : new Error(message);
}
