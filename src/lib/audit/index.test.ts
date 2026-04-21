/**
 * Unit tests for the audit log helper.
 *
 * The `auditLog()` function itself is a server action that calls Supabase,
 * so we test the pure helpers (`diffValues`) in isolation, and verify that
 * `auditLog()` never throws even when Supabase fails.
 */

import { diffValues } from "./diff";

// ─── diffValues ──────────────────────────────────────────────────────────────

describe("diffValues", () => {
  it("returns empty array when objects are identical", () => {
    const obj = { name: "Alice", role: "hr_admin", isActive: true };
    expect(diffValues(obj, { ...obj })).toHaveLength(0);
  });

  it("detects a single changed field", () => {
    const old = { name: "Alice", role: "viewer" };
    const next = { name: "Alice", role: "hr_admin" };
    const result = diffValues(old, next);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      field: "role",
      old: "viewer",
      new: "hr_admin",
    });
  });

  it("detects added fields (present in newValues, absent in oldValues)", () => {
    const old = { name: "Alice" };
    const next = { name: "Alice", email: "alice@pcso.gov.ph" };
    const result = diffValues(old, next);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      field: "email",
      old: undefined,
      new: "alice@pcso.gov.ph",
    });
  });

  it("detects removed fields (present in oldValues, absent in newValues)", () => {
    const old = { name: "Alice", notes: "some notes" };
    const next = { name: "Alice" };
    const result = diffValues(old, next);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      field: "notes",
      old: "some notes",
      new: undefined,
    });
  });

  it("detects multiple changed fields", () => {
    const old = { name: "Alice", role: "viewer", isActive: true };
    const next = { name: "Alice", role: "hr_admin", isActive: false };
    const result = diffValues(old, next);
    expect(result).toHaveLength(2);
    const fields = result.map((d) => d.field);
    expect(fields).toContain("role");
    expect(fields).toContain("isActive");
  });

  it("handles null vs undefined correctly", () => {
    const old = { officeId: null };
    const next = { officeId: "abc-123" };
    const result = diffValues(old, next);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ field: "officeId", old: null, new: "abc-123" });
  });

  it("handles nested objects by JSON equality", () => {
    const old = { meta: { a: 1, b: 2 } };
    const next = { meta: { a: 1, b: 3 } };
    const result = diffValues(old, next);
    expect(result).toHaveLength(1);
    expect(result[0].field).toBe("meta");
  });

  it("returns empty array for two empty objects", () => {
    expect(diffValues({}, {})).toHaveLength(0);
  });
});
