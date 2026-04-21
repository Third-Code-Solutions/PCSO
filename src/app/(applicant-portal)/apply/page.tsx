"use client";

import * as React from "react";
import {
  VacancyCard,
  type VacancyCardData,
} from "@/components/applicant-portal/vacancy-card";
import { Input } from "@/components/ui/input";

interface VacancyRow {
  id: string;
  title: string;
  positionTitle: string | null;
  officeId: string | null;
  salaryGrade: number | null;
  status: string;
  publishedAt: string | null;
  closingDate: string | null;
}

interface VacanciesResponse {
  data: VacancyRow[];
  meta: { total: number; page: number; perPage: number };
}

function asVacancyCardData(row: VacancyRow): VacancyCardData {
  return {
    id: row.id,
    title: row.title,
    positionTitle: row.positionTitle,
    salaryGrade: row.salaryGrade,
    publishedAt: row.publishedAt,
    closingDate: row.closingDate,
  };
}

export default function ApplyIndexPage() {
  const [query, setQuery] = React.useState("");
  const [rows, setRows] = React.useState<VacancyRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      params.set("perPage", "50");

      fetch(`/api/rpm/vacancies?${params.toString()}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Request failed (${res.status})`);
          const json = (await res.json()) as VacanciesResponse;
          if (!cancelled) setRows(json.data ?? []);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          if (e instanceof DOMException && e.name === "AbortError") return;
          setError(e instanceof Error ? e.message : "Failed to load vacancies");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(handle);
    };
  }, [query]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-[#e7ddc7] bg-white px-6 py-10 shadow-sm sm:px-10 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8a6d2c]">
          PCSO Careers
        </p>
        <h1 className="mt-3 max-w-3xl font-serif text-3xl font-semibold leading-tight text-[#0b1d3a] sm:text-4xl">
          Serve with purpose. Apply to the Philippine Charity Sweepstakes
          Office.
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-[#4b4943] sm:text-base">
          Browse published vacancies, submit a complete application, and track
          your status — all in one public portal.
        </p>

        <div className="mt-8 max-w-xl">
          <label htmlFor="vacancy-search" className="sr-only">
            Search vacancies
          </label>
          <Input
            id="vacancy-search"
            type="search"
            placeholder="Search position title or keyword…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 border-[#e7ddc7] bg-[#fdf8e9] focus-visible:ring-[#0b1d3a]"
          />
        </div>
      </section>

      <section aria-label="Open vacancies">
        {loading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-2xl border border-[#e7ddc7] bg-white"
                aria-hidden
              />
            ))}
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {!loading && !error && rows.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#c7a24a]/40 bg-white/60 px-6 py-10 text-center text-sm text-[#6a5a2b]">
            No published vacancies match your search.
          </p>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <VacancyCard key={row.id} vacancy={asVacancyCardData(row)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
