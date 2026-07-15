/**
 * RFC 7807 "Problem Details for HTTP APIs" helper — TOR 3.3.14 (API-004).
 *
 * EVERY non-2xx response from a /api/v1 route MUST be produced by
 * `problem()` so external integrators get one consistent error contract:
 *
 *   HTTP/1.1 422 Unprocessable Entity
 *   Content-Type: application/problem+json
 *
 *   {
 *     "type": "about:blank",
 *     "title": "Unprocessable Entity",
 *     "status": 422,
 *     "detail": "Validation failed",
 *     "errors": { ... }          ← extension member (zod flatten output)
 *   }
 *
 * `buildProblem` is pure (unit-testable without next/server);
 * `problem` wraps it in a NextResponse with the mandatory headers.
 */

import { NextResponse } from "next/server";

export const PROBLEM_CONTENT_TYPE = "application/problem+json";

export interface ProblemInput {
  /** HTTP status code (also emitted in the body per RFC 7807 §3.1). */
  status: number;
  /** Short, human-readable summary — stable across occurrences. */
  title: string;
  /** Occurrence-specific explanation. */
  detail?: string;
  /** URI reference identifying the problem type. Default "about:blank". */
  type?: string;
  /** URI reference identifying this specific occurrence (e.g. request path). */
  instance?: string;
  /** Validation errors extension member (typically zod `.flatten()` output). */
  errors?: unknown;
  /**
   * Additional extension members merged into the body — e.g. OAuth error
   * codes (`{ error: "invalid_client" }`), `missing_scopes`, `retry_after`.
   * Reserved RFC 7807 member names are ignored if present here.
   */
  extensions?: Record<string, unknown>;
  /** Extra response headers (e.g. Retry-After, WWW-Authenticate). */
  headers?: Record<string, string>;
}

export interface ProblemDocument {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: unknown;
  [extension: string]: unknown;
}

const RESERVED_MEMBERS = new Set([
  "type",
  "title",
  "status",
  "detail",
  "instance",
  "errors",
]);

export interface BuiltProblem {
  status: number;
  body: ProblemDocument;
  headers: Record<string, string>;
}

/** Pure core: assemble the problem document + headers. */
export function buildProblem(input: ProblemInput): BuiltProblem {
  const body: ProblemDocument = {
    type: input.type ?? "about:blank",
    title: input.title,
    status: input.status,
  };
  if (input.detail !== undefined) body.detail = input.detail;
  if (input.instance !== undefined) body.instance = input.instance;
  if (input.errors !== undefined) body.errors = input.errors;

  if (input.extensions) {
    for (const [key, value] of Object.entries(input.extensions)) {
      if (RESERVED_MEMBERS.has(key)) continue;
      body[key] = value;
    }
  }

  return {
    status: input.status,
    body,
    headers: {
      "Content-Type": PROBLEM_CONTENT_TYPE,
      // Convention: every v1 response is uncacheable (tokens, PII, errors).
      "Cache-Control": "no-store",
      ...(input.headers ?? {}),
    },
  };
}

/** NextResponse wrapper used by every /api/v1 route handler. */
export function problem(input: ProblemInput): NextResponse<ProblemDocument> {
  const built = buildProblem(input);
  return NextResponse.json(built.body, {
    status: built.status,
    headers: built.headers,
  });
}

/** Shorthand for zod validation failures (422 + flattened issues). */
export function validationProblem(
  errors: unknown,
  detail = "Validation failed",
): NextResponse<ProblemDocument> {
  return problem({
    status: 422,
    title: "Unprocessable Entity",
    detail,
    errors,
  });
}

/** Shorthand for uncaught route errors — never leaks stack traces. */
export function internalProblem(error: unknown): NextResponse<ProblemDocument> {
  const detail =
    error instanceof Error ? error.message : "Unexpected server error";
  return problem({
    status: 500,
    title: "Internal Server Error",
    detail,
  });
}
