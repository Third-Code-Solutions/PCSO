/**
 * /learning/certificates/generate — Batch certificate generation (LDM-010).
 *
 * Allows HR Admin to generate certificates for completed participants.
 */

import { desc, eq, isNull, and } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { ActionStatusBanner } from "@/components/feedback/action-status-banner";
import { db } from "@/lib/db";
import {
  trainingCertificates,
  trainingParticipants,
  trainingRuns,
  trainingPrograms,
} from "@/lib/db/schema/learning";
import { employees } from "@/lib/db/schema/employees";
import type { Metadata } from "next";
import { GenerateCertificateForm } from "./_components/generate-certificate-form";

export const metadata: Metadata = { title: "Generate Certificates" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function GenerateCertificatePage({
  searchParams,
}: PageProps) {
  const user = await requirePermission("learning", "create");
  const params = await searchParams;

  // Get completed participants without certificates
  const completedWithoutCerts = await db
    .select({
      participantId: trainingParticipants.id,
      employeeId: employees.id,
      employeeNo: employees.employeeNo,
      employeeFirst: employees.firstName,
      employeeLast: employees.lastName,
      programTitle: trainingPrograms.title,
      programCode: trainingPrograms.code,
      runId: trainingRuns.id,
      runNumber: trainingRuns.runNumber,
      completedAt: trainingParticipants.completedAt,
    })
    .from(trainingParticipants)
    .innerJoin(trainingRuns, eq(trainingParticipants.runId, trainingRuns.id))
    .innerJoin(
      trainingPrograms,
      eq(trainingPrograms.id, trainingRuns.programId),
    )
    .innerJoin(employees, eq(employees.id, trainingParticipants.employeeId))
    .leftJoin(
      trainingCertificates,
      eq(trainingCertificates.participantId, trainingParticipants.id),
    )
    .where(
      and(
        eq(trainingParticipants.status, "completed"),
        isNull(trainingCertificates.id),
        isNull(trainingRuns.deletedAt),
      ),
    )
    .orderBy(desc(trainingParticipants.completedAt))
    .limit(200);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <ActionStatusBanner
        status={typeof params.status === "string" ? params.status : undefined}
        entityLabel="Certificate"
      />

      <PageHeader
        title="Generate Certificates"
        description="Issue training certificates for completed participants."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "Certificates", href: "/learning/certificates" },
          { label: "Generate" },
        ]}
      />

      <div className="mt-6 overflow-hidden rounded-xl border shadow-sm bg-card">
        <div className="border-b bg-muted/40 px-4 py-3">
          <h2 className="text-sm font-semibold">
            Completed Participants Without Certificates
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {completedWithoutCerts.length} participant
            {completedWithoutCerts.length !== 1 ? "s" : ""} eligible
          </p>
        </div>

        {completedWithoutCerts.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            All completed participants have certificates.
          </div>
        ) : (
          <GenerateCertificateForm
            participants={completedWithoutCerts}
            issuedByEmployeeId={user.employeeId || ""}
          />
        )}
      </div>
    </main>
  );
}
