/**
 * /learning/certificates — Issued certificates index (LDM-010).
 *
 * Lists all certificates with PDF and QR-verification links.
 */

import { desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { db } from "@/lib/db";
import {
  trainingCertificates,
  trainingParticipants,
  trainingRuns,
  trainingPrograms,
} from "@/lib/db/schema/learning";
import { employees } from "@/lib/db/schema/employees";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Certificates" };

export default async function CertificatesListPage() {
  await requireAuth();

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
    .orderBy(desc(trainingCertificates.issuedAt))
    .limit(500);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title="Certificates"
        description="Issued training certificates with QR-verified authenticity."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "Certificates" },
        ]}
      />

      <div className="mt-6 overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
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
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.certificateNumber}
                  </td>
                  <td className="px-4 py-3">
                    {r.employeeFirst} {r.employeeLast}
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
                  <td className="px-4 py-3 font-mono text-xs">{r.runNumber}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.issuedAt).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex flex-col gap-0.5">
                      {r.pdfUrl ? (
                        <a
                          href={r.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-senate-navy hover:underline"
                        >
                          Download PDF
                        </a>
                      ) : (
                        <span className="text-muted-foreground">
                          PDF pending
                        </span>
                      )}
                      <a
                        href={`/verify/${r.qrTokenJwt}`}
                        className="text-senate-navy hover:underline"
                      >
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
