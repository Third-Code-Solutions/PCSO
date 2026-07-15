/**
 * Unit tests — RFC 7807 problem builder (TOR 3.3.14).
 * Exercises the pure `buildProblem` core (shape, headers, extensions).
 */
import { describe, it, expect } from "vitest";

import { buildProblem, PROBLEM_CONTENT_TYPE } from "./problem";

describe("buildProblem", () => {
  it("produces the minimal RFC 7807 document", () => {
    // Arrange + Act
    const built = buildProblem({ status: 404, title: "Not Found" });

    // Assert
    expect(built.status).toBe(404);
    expect(built.body).toEqual({
      type: "about:blank",
      title: "Not Found",
      status: 404,
    });
  });

  it("sets application/problem+json and no-store headers", () => {
    const built = buildProblem({ status: 500, title: "Internal Server Error" });
    expect(built.headers["Content-Type"]).toBe(PROBLEM_CONTENT_TYPE);
    expect(built.headers["Cache-Control"]).toBe("no-store");
  });

  it("includes detail, instance and errors when provided", () => {
    const built = buildProblem({
      status: 422,
      title: "Unprocessable Entity",
      detail: "Validation failed",
      instance: "/api/v1/employees",
      errors: { fieldErrors: { first_name: ["Required"] } },
    });
    expect(built.body.detail).toBe("Validation failed");
    expect(built.body.instance).toBe("/api/v1/employees");
    expect(built.body.errors).toEqual({
      fieldErrors: { first_name: ["Required"] },
    });
  });

  it("omits optional members when not provided", () => {
    const built = buildProblem({ status: 401, title: "Unauthorized" });
    expect("detail" in built.body).toBe(false);
    expect("instance" in built.body).toBe(false);
    expect("errors" in built.body).toBe(false);
  });

  it("merges extension members (OAuth error codes, scopes)", () => {
    const built = buildProblem({
      status: 403,
      title: "Forbidden",
      extensions: {
        error: "insufficient_scope",
        missing_scopes: ["payroll:read"],
      },
    });
    expect(built.body.error).toBe("insufficient_scope");
    expect(built.body.missing_scopes).toEqual(["payroll:read"]);
  });

  it("never lets extensions overwrite reserved RFC 7807 members", () => {
    const built = buildProblem({
      status: 400,
      title: "Bad Request",
      extensions: { status: 999, title: "spoofed", type: "spoofed" },
    });
    expect(built.body.status).toBe(400);
    expect(built.body.title).toBe("Bad Request");
    expect(built.body.type).toBe("about:blank");
  });

  it("honors a custom type URI and extra headers", () => {
    const built = buildProblem({
      status: 429,
      title: "Too Many Requests",
      type: "https://hris.pcso.gov.ph/problems/rate-limit",
      headers: { "Retry-After": "42" },
    });
    expect(built.body.type).toBe(
      "https://hris.pcso.gov.ph/problems/rate-limit",
    );
    expect(built.headers["Retry-After"]).toBe("42");
    // Base headers survive the merge.
    expect(built.headers["Content-Type"]).toBe(PROBLEM_CONTENT_TYPE);
  });
});
