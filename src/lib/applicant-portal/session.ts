"use client";

/**
 * Applicant-portal session helpers (public, NO internal auth).
 *
 * The RPM applicant API sets an httpOnly session cookie. The internal
 * Supabase session is never touched by this public portal.
 */

import * as React from "react";

const SESSION_MARKER = "pcso-applicant-session";
const EVENT_NAME = "pcso:applicant-session";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function getApplicantToken(): string | null {
  if (!isBrowser()) return null;
  return document.cookie
    .split("; ")
    .some((entry) => entry.startsWith(SESSION_MARKER + "=1"))
    ? "httpOnly-cookie"
    : null;
}

export function setApplicantToken(): void {
  if (!isBrowser()) return;
  document.cookie = SESSION_MARKER + "=1; Path=/; Max-Age=86400; SameSite=Lax";
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function clearApplicantToken(): void {
  if (!isBrowser()) return;
  document.cookie = SESSION_MARKER + "=; Path=/; Max-Age=0; SameSite=Lax";
  void fetch("/api/rpm/applicants/logout", {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function authHeaders(): Record<string, string> {
  return {};
}

/**
 * Client-only hint: true when the non-sensitive session marker exists. Pages
 * MUST still validate by making an authenticated request.
 */
export function useApplicantSessionHint(): boolean {
  const [hasSession, setHasSession] = React.useState(false);

  React.useEffect(() => {
    function read() {
      setHasSession(getApplicantToken() !== null);
    }
    read();
    window.addEventListener(EVENT_NAME, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVENT_NAME, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  return hasSession;
}
