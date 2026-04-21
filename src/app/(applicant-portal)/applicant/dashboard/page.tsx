"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/applicant-portal/status-badge";
import { authHeaders, getApplicantToken } from "@/lib/applicant-portal/session";

interface ApplicationRow {
  id: string;
  vacancyId: string;
  status: string;
  matchScore: number | null;
  submittedAt: string | null;
  createdAt: string | null;
}

interface ApplicationsResponse {
  data: ApplicationRow[];
}

export default function ApplicantDashboardPage() {
  const router = useRouter();
  const [rows, setRows] = React.useState<ApplicationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const token = getApplicantToken();
    if (!token) {
      router.replace("/applicant/login?next=%2Fapplicant%2Fdashboard");
      return;
    }

    let cancelled = false;
    fetch("/api/rpm/applications", { headers: { ...authHeaders() } })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/applicant/login?next=%2Fapplicant%2Fdashboard");
          return;
        }
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = (await res.json()) as ApplicationsResponse;
        if (!cancelled) setRows(json.data ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : "Failed to load applications",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8a6d2c]">
            Applicant portal
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-[#0b1d3a]">
            My applications
          </h1>
        </div>
        <Button
          asChild
          className="bg-[#0b1d3a] text-[#fdf8e9] hover:bg-[#0a1830]"
        >
          <Link href="/apply">Browse vacancies</Link>
        </Button>
      </header>

      {loading && (
        <div
          className="h-48 animate-pulse rounded-2xl border border-[#e7ddc7] bg-white"
          aria-busy="true"
        />
      )}

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="rounded-2xl border border-dashed border-[#c7a24a]/40 bg-white/60 px-6 py-10 text-center text-sm text-[#6a5a2b]">
          You haven&rsquo;t started any applications yet.
        </p>
      )}

      {!loading && !error && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between rounded-xl border border-[#e7ddc7] bg-white px-5 py-4 shadow-sm"
            >
              <div>
                <p className="font-medium text-[#0b1d3a]">
                  Application #{row.id.slice(0, 8)}
                </p>
                <p className="text-xs text-[#6a5a2b]">
                  {row.submittedAt
                    ? `Submitted ${new Date(row.submittedAt).toISOString().slice(0, 10)}`
                    : row.createdAt
                      ? `Started ${new Date(row.createdAt).toISOString().slice(0, 10)}`
                      : "Draft"}
                  {row.matchScore !== null && (
                    <>
                      {" · "}Match {row.matchScore}%
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={row.status} />
                <Button asChild size="sm" variant="outline">
                  <Link href={`/applicant/applications/${row.id}`}>Open</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
