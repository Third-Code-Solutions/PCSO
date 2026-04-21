"use client";

/**
 * Applicant-portal session helpers (public, NO internal auth).
 *
 * The RPM applicant API returns a signed JWT in the login response body.
 * We persist it in localStorage and attach it as `Authorization: Bearer …`
 * on subsequent fetches. The internal Supabase session is never touched.
 *
 * Rationale: the login endpoint does not set an httpOnly cookie (see
 * src/app/api/rpm/applicants/login/route.ts), so a client-side cookie set
 * from JS would be first-party but not httpOnly — functionally equivalent
 * to localStorage for our threat model, while being harder to reason about
 * across SSR. localStorage is simpler and keeps the API contract unchanged.
 */

import * as React from "react";

const STORAGE_KEY = "pcso-applicant-token";
const EVENT_NAME = "pcso:applicant-session";

export interface ApplicantSession {
  token: string;
  storedAt: number;
}

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

export function getApplicantToken(): string | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "token" in parsed &&
      typeof (parsed as { token: unknown }).token === "string"
    ) {
      return (parsed as { token: string }).token;
    }
    return null;
  } catch {
    return null;
  }
}

export function setApplicantToken(token: string): void {
  if (!isBrowser()) return;
  const payload: ApplicantSession = { token, storedAt: Date.now() };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function clearApplicantToken(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function authHeaders(): Record<string, string> {
  const token = getApplicantToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Client-only hint: true when a token exists. Pages MUST still validate by
 * making an authenticated request; a stale token does not prove authorization.
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
