/**
 * Unit tests — v1 scope catalog + scope checker.
 */
import { describe, it, expect } from "vitest";

import {
  API_SCOPES,
  API_SCOPE_VALUES,
  hasRequiredScopes,
  intersectScopes,
  isKnownScope,
  missingScopes,
  parseScopeParam,
} from "./scopes";

describe("API_SCOPES catalog", () => {
  it("contains unique scope strings in resource:action format", () => {
    const values = API_SCOPES.map((s) => s.scope);
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) {
      expect(value).toMatch(/^[a-z_-]+:[a-z_-]+$/);
    }
  });

  it("every scope carries a description for the admin UI", () => {
    for (const definition of API_SCOPES) {
      expect(definition.description.length).toBeGreaterThan(10);
    }
  });

  it("covers the scopes the v1 routes enforce", () => {
    for (const required of [
      "employees:read",
      "employees:write",
      "leave:read",
      "payroll:read",
      "jobs:read",
      "jobs:write",
    ]) {
      expect(API_SCOPE_VALUES).toContain(required);
    }
  });
});

describe("isKnownScope", () => {
  it("accepts catalog scopes and rejects unknown ones", () => {
    expect(isKnownScope("employees:read")).toBe(true);
    expect(isKnownScope("employees:admin")).toBe(false);
    expect(isKnownScope("")).toBe(false);
  });
});

describe("missingScopes / hasRequiredScopes", () => {
  it("passes when all required scopes are granted", () => {
    // Arrange
    const granted = ["employees:read", "employees:write", "jobs:read"];

    // Act + Assert
    expect(missingScopes(granted, ["employees:read", "jobs:read"])).toEqual([]);
    expect(hasRequiredScopes(granted, ["employees:read"])).toBe(true);
  });

  it("reports exactly the missing scopes", () => {
    const granted = ["employees:read"];
    expect(missingScopes(granted, ["employees:read", "payroll:read"])).toEqual([
      "payroll:read",
    ]);
    expect(hasRequiredScopes(granted, ["payroll:read"])).toBe(false);
  });

  it("passes trivially when nothing is required", () => {
    expect(hasRequiredScopes([], [])).toBe(true);
    expect(missingScopes([], [])).toEqual([]);
  });

  it("fails when nothing is granted but something is required", () => {
    expect(hasRequiredScopes([], ["jobs:write"])).toBe(false);
  });

  it("does not treat unknown granted scopes as wildcards", () => {
    expect(hasRequiredScopes(["*", "admin:all"], ["employees:read"])).toBe(
      false,
    );
  });
});

describe("intersectScopes", () => {
  it("returns the intersection preserving first-list order", () => {
    expect(
      intersectScopes(
        ["leave:read", "employees:read", "payroll:read"],
        ["payroll:read", "employees:read"],
      ),
    ).toEqual(["employees:read", "payroll:read"]);
  });

  it("deduplicates the result", () => {
    expect(
      intersectScopes(["employees:read", "employees:read"], ["employees:read"]),
    ).toEqual(["employees:read"]);
  });

  it("returns empty when disjoint", () => {
    expect(intersectScopes(["a:b"], ["c:d"])).toEqual([]);
  });
});

describe("parseScopeParam", () => {
  it("splits a space-delimited scope string", () => {
    expect(parseScopeParam("employees:read leave:read")).toEqual([
      "employees:read",
      "leave:read",
    ]);
  });

  it("collapses repeated whitespace and duplicates", () => {
    expect(parseScopeParam("  a:b   a:b\tc:d ")).toEqual(["a:b", "c:d"]);
  });

  it("returns empty for null/undefined/blank", () => {
    expect(parseScopeParam(null)).toEqual([]);
    expect(parseScopeParam(undefined)).toEqual([]);
    expect(parseScopeParam("")).toEqual([]);
  });
});
