import { Suspense } from "react";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { db } from "@/lib/db";
import { gsisRemittanceBatches } from "@/lib/db/schema";
import { eq, and, isNull, count, gte } from "drizzle-orm";
import { getGsisBatches } from "./actions";
import { GsisBatchTable } from "@/components/remittances/gsis-batch-table";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata = {
  title: "GSIS Remittance",
};

// ─── Stat fetch ───────────────────────────────────────────────────────────────

async function fetchGsisStats() {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [thisYear, pending, submitted, accepted] = await Promise.all([
    db
      .select({ cnt: count() })
      .from(gsisRemittanceBatches)
      .where(
        and(
          isNull(gsisRemittanceBatches.deletedAt),
          gte(gsisRemittanceBatches.createdAt, yearStart),
        ),
      ),
    db
      .select({ cnt: count() })
      .from(gsisRemittanceBatches)
      .where(
        and(
          eq(gsisRemittanceBatches.status, "generated"),
          isNull(gsisRemittanceBatches.deletedAt),
        ),
      ),
    db
      .select({ cnt: count() })
      .from(gsisRemittanceBatches)
      .where(
        and(
          eq(gsisRemittanceBatches.status, "submitted"),
          isNull(gsisRemittanceBatches.deletedAt),
        ),
      ),
    db
      .select({ cnt: count() })
      .from(gsisRemittanceBatches)
      .where(
        and(
          eq(gsisRemittanceBatches.status, "accepted"),
          isNull(gsisRemittanceBatches.deletedAt),
        ),
      ),
  ]);

  return {
    thisYear: Number(thisYear[0]?.cnt ?? 0),
    pending: Number(pending[0]?.cnt ?? 0),
    submitted: Number(submitted[0]?.cnt ?? 0),
    accepted: Number(accepted[0]?.cnt ?? 0),
  };
}

// ─── Async data component ─────────────────────────────────────────────────────

async function GsisBatchList() {
  const batches = await getGsisBatches({ page: 1, perPage: 20 });
  return <GsisBatchTable batches={batches} />;
}

// ─── Stats summary ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-pcso-navy">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GsisRemittancePage() {
  await requirePermission("remittances", "view");
  const stats = await fetchGsisStats();

  return (
    <div className="space-y-8">
      <RealtimeBoundary tables={["gsis_remittance_batches"]} />

      {/* Page header */}
      <PageHeader
        title="GSIS Remittance"
        description="Generate, export, and track GSIS contribution batches per payroll period. Employee share: 9% · Employer share: 12%."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Remittances", href: "/remittances" },
          { label: "GSIS" },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/remittances/gsis/retirement"
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              Retirement Tracker
            </Link>
            <Link
              href="/remittances/gsis/new"
              className="rounded-lg bg-pcso-navy px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-pcso-navy-light"
            >
              Generate Batch
            </Link>
          </div>
        }
      />

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="This Year"
          value={stats.thisYear}
          sub="batches generated"
        />
        <StatCard
          label="Pending Submission"
          value={stats.pending}
          sub="generated, not yet submitted"
        />
        <StatCard
          label="Submitted"
          value={stats.submitted}
          sub="awaiting GSIS confirmation"
        />
        <StatCard
          label="Accepted"
          value={stats.accepted}
          sub="confirmed by GSIS portal"
        />
      </div>

      {/* Batch table */}
      <section aria-labelledby="batches-heading">
        <h2
          id="batches-heading"
          className="mb-4 text-base font-semibold text-zinc-800"
        >
          Remittance Batches
        </h2>
        <Suspense
          fallback={
            <div
              className="h-48 animate-pulse rounded-xl bg-zinc-100"
              aria-label="Loading batches…"
            />
          }
        >
          <GsisBatchList />
        </Suspense>
      </section>

      {/* Informational note */}
      <aside className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-4">
        <p className="text-sm font-medium text-amber-800">GSIS Portal Upload</p>
        <p className="mt-1 text-xs text-amber-700">
          After generating a batch, export the Excel or CSV file and upload it
          manually to the{" "}
          <a
            href="https://www.gsis.gov.ph"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            GSIS Electronic Services Portal
          </a>
          . Then return here to record the portal reference number.
        </p>
      </aside>
    </div>
  );
}
