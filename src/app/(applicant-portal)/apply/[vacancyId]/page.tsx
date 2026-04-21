"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authHeaders, getApplicantToken } from "@/lib/applicant-portal/session";

interface Vacancy {
  id: string;
  title: string;
  positionTitle: string | null;
  salaryGrade: number | null;
  status: string;
  publishedAt: string | null;
  closingDate: string | null;
  description?: string | null;
  qualificationStandards?: Record<string, unknown> | null;
}

interface VacancyResponse {
  data: Vacancy;
}

export default function VacancyDetailPage() {
  const routeParams = useParams<{ vacancyId: string }>();
  const vacancyId = routeParams.vacancyId;
  const router = useRouter();

  const [vacancy, setVacancy] = React.useState<Vacancy | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/rpm/vacancies/${vacancyId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Vacancy not found (${res.status})`);
        const json = (await res.json()) as VacancyResponse;
        if (!cancelled) setVacancy(json.data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load vacancy");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [vacancyId]);

  async function handleApplyClick() {
    setError(null);
    if (!getApplicantToken()) {
      const next = encodeURIComponent(`/apply/${vacancyId}`);
      router.push(`/applicant/login?next=${next}`);
      return;
    }

    setApplying(true);
    try {
      const res = await fetch("/api/rpm/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ vacancyId }),
      });
      if (res.status === 401) {
        const next = encodeURIComponent(`/apply/${vacancyId}`);
        router.push(`/applicant/login?next=${next}`);
        return;
      }
      if (!res.ok) {
        const problem = (await res.json().catch(() => ({}))) as {
          detail?: string;
        };
        throw new Error(problem.detail ?? `Request failed (${res.status})`);
      }
      const json = (await res.json()) as { data: { id: string } };
      router.push(`/applicant/applications/new?applicationId=${json.data.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start application");
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div
        className="h-64 animate-pulse rounded-2xl border border-[#e7ddc7] bg-white"
        aria-busy="true"
      />
    );
  }

  if (error || !vacancy) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        {error ?? "Vacancy not found."}
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/apply">Back to vacancies</Link>
          </Button>
        </div>
      </div>
    );
  }

  const closing = vacancy.closingDate
    ? new Date(vacancy.closingDate).toISOString().slice(0, 10)
    : null;

  return (
    <article className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm text-[#6a5a2b]">
        <Link href="/apply" className="hover:underline">
          ← All vacancies
        </Link>
      </nav>

      <header className="rounded-3xl border border-[#e7ddc7] bg-white p-6 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8a6d2c]">
          {vacancy.positionTitle ?? "Vacancy"}
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight text-[#0b1d3a]">
          {vacancy.title}
        </h1>

        <dl className="mt-5 grid gap-3 text-sm text-[#4b4943] sm:grid-cols-3">
          {vacancy.salaryGrade !== null && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-[#8a6d2c]">
                Salary grade
              </dt>
              <dd className="mt-1 text-base font-medium tabular-nums">
                SG {vacancy.salaryGrade}
              </dd>
            </div>
          )}
          {closing && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-[#8a6d2c]">
                Application closes
              </dt>
              <dd className="mt-1 text-base font-medium tabular-nums">
                {closing}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#8a6d2c]">
              Status
            </dt>
            <dd className="mt-1 text-base font-medium capitalize">
              {vacancy.status}
            </dd>
          </div>
        </dl>

        {vacancy.description && (
          <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-[#2b2925]">
            {vacancy.description}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={handleApplyClick}
            disabled={applying}
            className="bg-[#0b1d3a] text-[#fdf8e9] hover:bg-[#0a1830]"
          >
            {applying ? "Starting…" : "Apply for this position"}
          </Button>
          <Button asChild variant="outline">
            <Link href="/apply">Back</Link>
          </Button>
        </div>
      </header>
    </article>
  );
}
