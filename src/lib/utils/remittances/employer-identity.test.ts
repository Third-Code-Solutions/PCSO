/**
 * Employer identity guards — unit tests (PRD P0-003)
 */

import { describe, it, expect } from "vitest";
import {
  isPlaceholderEmployerIdentifier,
  requireEmployerIdentifier,
} from "./employer-identity";

// ─── isPlaceholderEmployerIdentifier ─────────────────────────────────────────

describe("isPlaceholderEmployerIdentifier", () => {
  it("treats null and undefined as placeholder", () => {
    expect(isPlaceholderEmployerIdentifier(null)).toBe(true);
    expect(isPlaceholderEmployerIdentifier(undefined)).toBe(true);
  });

  it("treats empty and whitespace-only strings as placeholder", () => {
    expect(isPlaceholderEmployerIdentifier("")).toBe(true);
    expect(isPlaceholderEmployerIdentifier("   ")).toBe(true);
  });

  it("treats all-zero identifiers as placeholder", () => {
    expect(isPlaceholderEmployerIdentifier("0")).toBe(true);
    expect(isPlaceholderEmployerIdentifier("000000000000")).toBe(true);
  });

  it("treats all-zero identifiers with separators as placeholder", () => {
    // Seeded org_profile placeholder formats
    expect(isPlaceholderEmployerIdentifier("000-000-000-000")).toBe(true);
    expect(isPlaceholderEmployerIdentifier("000 000 000")).toBe(true);
  });

  it("treats separator-only strings as placeholder", () => {
    expect(isPlaceholderEmployerIdentifier("---")).toBe(true);
  });

  it("accepts real identifiers", () => {
    expect(isPlaceholderEmployerIdentifier("123456789012")).toBe(false);
    expect(isPlaceholderEmployerIdentifier("123-456-789-000")).toBe(false);
    expect(isPlaceholderEmployerIdentifier("PH-ER-2026-0001")).toBe(false);
  });

  it("does not flag identifiers with some non-zero digits", () => {
    expect(isPlaceholderEmployerIdentifier("0001")).toBe(false);
    expect(isPlaceholderEmployerIdentifier("000-000-000-001")).toBe(false);
  });
});

// ─── requireEmployerIdentifier ───────────────────────────────────────────────

describe("requireEmployerIdentifier", () => {
  it("returns the trimmed identifier when configured", () => {
    expect(requireEmployerIdentifier("123456789012", "PhilHealth employer number")).toBe(
      "123456789012",
    );
    expect(requireEmployerIdentifier("  123-456-789  ", "BIR TIN")).toBe(
      "123-456-789",
    );
  });

  it("throws for null, undefined, and blank values", () => {
    expect(() => requireEmployerIdentifier(null, "GSIS employer number")).toThrow(
      /GSIS employer number is not configured/,
    );
    expect(() =>
      requireEmployerIdentifier(undefined, "Pag-IBIG employer number"),
    ).toThrow(/Pag-IBIG employer number is not configured/);
    expect(() => requireEmployerIdentifier("", "BIR TIN")).toThrow(
      /BIR TIN is not configured/,
    );
  });

  it("throws for seed placeholder values", () => {
    expect(() =>
      requireEmployerIdentifier("000000000000", "PhilHealth employer number"),
    ).toThrow(/not configured/);
    expect(() => requireEmployerIdentifier("000-000-000-000", "BIR TIN")).toThrow(
      /not configured/,
    );
  });

  it("points the admin to the org profile settings page", () => {
    expect(() => requireEmployerIdentifier(null, "BIR TIN")).toThrow(
      /\/admin\/settings\/org-profile/,
    );
  });
});
