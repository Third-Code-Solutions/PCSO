/**
 * /learning/certificates — Issued certificates index (LDM-010).
 *
 * Lists all certificates with PDF and QR-verification links.
 * Allows HR Admin to generate certificates for completed participants.
 */

import { desc, eq, isNull, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { ActionStatusBanner } from "@/components/feedback/action-status-banner";
import { RoleGate } from "@/components/role-gate";
import { db } from "@/lib/db";
import {
  trainingCertificates,
  trainingParticipants,
  trainingRuns,
  trainingPrograms,
} from "@/lib/db/schema/learning";
import { employees } from "@/lib/db/schema/employees";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Metadata } from "next";
import { FileText, Award, Download, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Certificates" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CertificatesListPage({
  searchParams,
}: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;

  const rows = await db
    .select({
      id: trainingCertificates.id,
      certificateNumber: trainingCertificates.certificateNumber,
      issuedAt: trainingCertificates.issuedAt,
      pdfUrl: trainingCertificates.pdfUrl,
      qrTokenJwt: trainingCertificates.qrTokenJwt,
      participantId: trainingCertificates.participantId,
      employeeFirst: employees.firstName,
      employeeLast: employees.lastName,
      employeeNo: employees.employeeNo,
      programTitle: trainingPrograms.title,
      programCode: trainingPrograms.code,
      runNumber: trainingRuns.runNumber,
      runId: trainingRuns.id,
    })
    .from(trainingCertificates)
    .innerJoin(
      trainingParticipants,
      eq(trainingParticipants.id, trainingCertificates.participantId),
    )
    .innerJoin(trainingRuns, eq(trainingRuns.id, trainingParticipants.runId))
    .innerJoin(
      trainingPrograms,
      eq(trainingPrograms.id, trainingRuns.programId),
    )
    .innerJoin(employees, eq(employees.id, trainingParticipants.employeeId))
    .where(isNull(trainingRuns.deletedAt))
    .orderBy(desc(trainingCertificates.issuedAt))
    .limit(500);

  // Get stats for header
  const stats = await db
    .select({
      totalCertificates: db.$count(trainingCertificates.id),
    })
    .from(trainingCertificates)
    .then((r) => r[0]);

  // Get completed participants without certificates (for generation)
  const completedWithoutCerts = await db
    .select({
      participantId: trainingParticipants.id,
      employeeName: employees.lastName,
      programTitle: trainingPrograms.title,
      runNumber: trainingRuns.runNumber,
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
    .limit(100);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <ActionStatusBanner
        status={
          typeof params["status"] === "string" ? params["status"] : undefined
        }
        entityLabel="Certificate"
      />

      <PageHeader
        title="Training Certificates"
        description="QR-verified certificates of training completion with centralized serial numbers."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "Certificates" },
        ]}
        actions={
          <RoleGate role={user.role} roles={["super_admin", "hr_admin"]}>
            <Link href="/learning/certificates/generate">
              <Button className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream">
                <Award className="mr-2 h-4 w-4" />
                Generate Certificates
              </Button>
            </Link>
          </RoleGate>
        }
      />

      {/* Stats Cards */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-pcso-navy/10 p-2">
              <Award className="h-5 w-5 text-pcso-navy" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Total Issued
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {stats?.totalCertificates || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <CheckCircle2 className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Pending Generation
              </p>
              <p className="text-2xl font-bold tabular-nums text-amber-600">
                {completedWithoutCerts.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                With PDF
              </p>
              <p className="text-2xl font-bold tabular-nums text-green-600">
                {rows.filter((r) => r.pdfUrl).length}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Issued Certificates Table */}
      <div className="mt-6 overflow-hidden rounded-xl border shadow-sm">
        <div className="border-b bg-muted/40 px-4 py-3">
          <h2 className="text-sm font-semibold">Issued Certificates</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/20">
            <tr>
              {[
                "Certificate",
                "Employee",
                "Program",
                "Run",
                "Issued",
                "Links",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No certificates issued yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-pcso-navy" />
                      <span className="font-mono text-xs font-semibold">
                        {r.certificateNumber}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/employees/${r.participantId}`}
                      className="hover:text-pcso-navy hover:underline"
                    >
                      {r.employeeFirst} {r.employeeLast}
                    </Link>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {r.employeeNo}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{r.programTitle}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {r.programCode}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/learning/schedule/${r.runId}`}
                      className="font-mono text-xs text-pcso-navy hover:underline"
                    >
                      {r.runNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.issuedAt).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex flex-col gap-1.5">
                      {r.pdfUrl ? (
                        <a
                          href={r.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-pcso-navy hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download PDF
                        </a>
                      ) : (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" />
                          PDF pending
                        </span>
                      )}
                      <a
                        href={`/verify/${r.qrTokenJwt}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-pcso-navy hover:underline"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Verify QR
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
