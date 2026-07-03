import * as React from "react";
import { ShieldCheck } from "lucide-react";

const MANILA_TZ = "Asia/Manila";

const DATE_FORMAT = new Intl.DateTimeFormat("en-PH", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: MANILA_TZ,
});

const HOUR_FORMAT = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  hour12: false,
  timeZone: MANILA_TZ,
});

function getGreeting(now: Date): string {
  const hour = Number(HOUR_FORMAT.format(now));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export interface DashboardHeroProps {
  title: string;
  description: string;
  /** Human-readable role name, e.g. "HR Administrator". */
  roleLabel: string;
  /** Data scope shown next to the role (PRD 3.4.4), e.g. "All Units". */
  scope: string;
}

/**
 * Dashboard masthead: PCSO navy band with greeting, Manila date, page title,
 * and the mandatory role + data-scope badge (PRD 3.4.4).
 */
export function DashboardHero({
  title,
  description,
  roleLabel,
  scope,
}: DashboardHeroProps) {
  const now = new Date();

  return (
    <section className="relative overflow-hidden rounded-xl bg-pcso-navy text-white shadow-sm">
      {/* Gold accent rule — PCSO seal palette */}
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pcso-gold via-pcso-gold-light to-pcso-gold"
        aria-hidden
      />
      {/* Soft depth washes, kept inside the band */}
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-pcso-navy-light/40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 right-32 h-64 w-64 rounded-full bg-pcso-gold/10 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-7">
        <div className="min-w-0">
          <p className="text-sm text-white/70">
            {getGreeting(now)} · {DATE_FORMAT.format(now)}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-white/75">
            {description}
          </p>
        </div>

        <div className="shrink-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium backdrop-blur-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-pcso-gold" aria-hidden />
            <span>{roleLabel}</span>
            <span className="text-white/40" aria-hidden>
              ·
            </span>
            <span className="text-white/75">{scope}</span>
          </span>
        </div>
      </div>
    </section>
  );
}
