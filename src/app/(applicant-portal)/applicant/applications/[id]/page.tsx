"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/applicant-portal/status-badge";
import { authHeaders, getApplicantToken } from "@/lib/applicant-portal/session";

interface ApplicationInterview {
  scheduledAt: string;
  venue: string;
  mode: string;
  notes: string | null;
}

interface ApplicationDetail {
  id: string;
  vacancyId: string;
  status: string;
  matchScore: number | null;
  submittedAt: string | null;
  createdAt: string | null;
  disqualificationReason?: string | null;
  interview?: ApplicationInterview | null;
}

const INTERVIEW_MODE_LABELS: Record<string, string> = {
  in_person: "In person",
  online: "Online (video call)",
  phone: "Phone call",
};

export default function ApplicationStatusPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = React.useState<ApplicationDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!getApplicantToken()) {
      router.replace(
        `/applicant/login?next=${encodeURIComponent(`/applicant/applications/${id}`)}`,
      );
      return;
    }

    let cancelled = false;
    fetch(`/api/rpm/applications/${id}`, { headers: { ...authHeaders() } })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/applicant/login");
          return;
        }
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = (await res.json()) as { data: ApplicationDetail };
        if (!cancelled) setDetail(json.data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load application");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (loading) {
    return (
      <div
        className="h-48 animate-pulse rounded-2xl border border-[#e7ddc7] bg-white"
        aria-busy="true"
      />
    );
  }

  if (error || !detail) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        {error ?? "Application not found."}
      </div>
    );
  }

  return (
    <article className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-[#6a5a2b]">
        <Link href="/applicant/dashboard" className="hover:underline">
          ← My applications
        </Link>
      </nav>

      <header className="rounded-3xl border border-[#e7ddc7] bg-white p-6 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8a6d2c]">
          Application
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#0b1d3a]">
          Application #{detail.id.slice(0, 8)}
        </h1>

        <div className="mt-6 grid gap-4 text-sm text-[#4b4943] sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#8a6d2c]">
              Status
            </p>
            <StatusBadge status={detail.status} className="mt-2" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[#8a6d2c]">
              Submitted
            </p>
            <p className="mt-2 tabular-nums">
              {detail.submittedAt
                ? new Date(detail.submittedAt).toISOString().slice(0, 10)
                : "Not yet submitted"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[#8a6d2c]">
              Match score
            </p>
            <p className="mt-2 tabular-nums">
              {detail.matchScore !== null ? `${detail.matchScore}%` : "—"}
            </p>
          </div>
        </div>

        {detail.interview ? (
          <section
            aria-label="Interview schedule"
            className="mt-8 rounded-2xl border border-[#c8a84b]/50 bg-[#fdf8e9] p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6d2c]">
              Interview schedule
            </p>
            <div className="mt-3 grid gap-3 text-sm text-[#4b4943] sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#8a6d2c]">
                  Date &amp; time
                </p>
                <p className="mt-1 font-medium text-[#0b1d3a]">
                  {new Date(detail.interview.scheduledAt).toLocaleString(
                    "en-PH",
                    { dateStyle: "full", timeStyle: "short" },
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#8a6d2c]">
                  Venue
                </p>
                <p className="mt-1">{detail.interview.venue}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#8a6d2c]">
                  Mode
                </p>
                <p className="mt-1">
                  {INTERVIEW_MODE_LABELS[detail.interview.mode] ??
                    detail.interview.mode}
                </p>
              </div>
            </div>
            {detail.interview.notes ? (
              <p className="mt-3 text-sm text-[#4b4943]">
                <span className="font-medium text-[#0b1d3a]">Notes:</span>{" "}
                {detail.interview.notes}
              </p>
            ) : null}
          </section>
        ) : null}

        {detail.status === "not_qualified" && detail.disqualificationReason ? (
          <section
            aria-label="Disqualification reason"
            className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-[#4b4943]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-destructive">
              Reason
            </p>
            <p className="mt-2">{detail.disqualificationReason}</p>
          </section>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/applicant/dashboard">Back to applications</Link>
          </Button>
          {detail.status === "draft" && (
            <Button
              asChild
              className="bg-[#0b1d3a] text-[#fdf8e9] hover:bg-[#0a1830]"
            >
              <Link
                href={`/applicant/applications/new?applicationId=${detail.id}`}
              >
                Continue application
              </Link>
            </Button>
          )}
        </div>
      </header>
    </article>
  );
}
