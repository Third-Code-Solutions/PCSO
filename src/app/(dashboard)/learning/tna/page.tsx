/**
 * /learning/tna — Training Needs Analysis (LDM-013).
 *
 * Office-wide competency gap summary. Filter by office.
 */

import Link from "next/link";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { db } from "@/lib/db";
import { tnaGaps } from "@/lib/db/schema/learning";
import { employees } from "@/lib/db/schema/employees";
import { offices } from "@/lib/db/schema/offices";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Training Needs Analysis" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TnaListPage({ searchParams }: PageProps) {
  await requireAuth();
  const params = await searchParams;
  const officeId = Array.isArray(params["officeId"])
    ? params["officeId"][0]
    : params["officeId"];

  const officeFilters = [isNull(employees.deletedAt)];
  if (officeId) officeFilters.push(eq(employees.officeId, officeId));

  const [officeRows, aggregatedRows] = await Promise.all([
    db
      .select({ id: offices.id, name: offices.name })
      .from(offices)
      .orderBy(offices.name),
    db
      .select({
        employeeId: employees.id,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        lastName: employees.lastName,
        officeName: offices.name,
        gapCount: count(tnaGaps.id),
      })
      .from(employees)
      .leftJoin(offices, eq(offices.id, employees.officeId))
      .leftJoin(tnaGaps, eq(tnaGaps.employeeId, employees.id))
      .where(and(...officeFilters))
      .groupBy(
        employees.id,
        employees.employeeNo,
        employees.firstName,
        employees.lastName,
        offices.name,
      )
      .orderBy(desc(count(tnaGaps.id)))
      .limit(500),
  ]);

  const withGaps = aggregatedRows.filter((r) => Number(r.gapCount) > 0);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title="Training Needs Analysis"
        description="Competency gaps per employee. Click to view gaps and assign to a program."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "TNA" },
        ]}
      />

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/learning/tna"
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            !officeId
              ? "border-pcso-navy bg-pcso-navy text-pcso-cream"
              : "border-border hover:bg-muted/40"
          }`}
        >
          All offices
        </Link>
        {officeRows.map((o) => (
          <Link
            key={o.id}
            href={`/learning/tna?officeId=${o.id}`}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              officeId === o.id
                ? "border-pcso-navy bg-pcso-navy text-pcso-cream"
                : "border-border hover:bg-muted/40"
            }`}
          >
            {o.name}
          </Link>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              {["Employee", "No.", "Office", "Gaps", ""].map((h) => (
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
            {withGaps.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No competency gaps identified.
                </td>
              </tr>
            ) : (
              withGaps.map((r) => (
                <tr
                  key={r.employeeId}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">
                    {r.firstName} {r.lastName}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.employeeNo}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.officeName ?? "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {Number(r.gapCount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/learning/tna/${r.employeeId}`}
                      className="text-xs font-medium text-pcso-navy hover:underline"
                    >
                      View gaps →
                    </Link>
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
