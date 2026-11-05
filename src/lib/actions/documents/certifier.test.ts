import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { pickCertifier, type CertifierCandidate } from "./certifier";

const row = (over: Partial<CertifierCandidate>): CertifierCandidate => ({
  documentTypeCode: "COE",
  certifierName: "Maria L. Santos",
  certifierPosition: "Department Manager, HRD",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  employee: null,
  ...over,
});

describe("pickCertifier (H-18)", () => {
  it("returns the typed name and position of the effective row", () => {
    expect(pickCertifier([row({})], ["COE"], "2026-11-05")).toEqual({
      name: "Maria L. Santos",
      title: "Department Manager, HRD",
    });
  });

  it("returns null when nothing is configured (no placeholder)", () => {
    expect(pickCertifier([], ["COE"], "2026-11-05")).toBeNull();
  });

  it("ignores rows outside their effectivity window", () => {
    const rows = [
      row({ effectiveFrom: "2027-01-01" }),
      row({ effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31" }),
    ];
    expect(pickCertifier(rows, ["COE"], "2026-11-05")).toBeNull();
  });

  it("prefers the latest effectiveFrom among overlapping rows", () => {
    const rows = [
      row({ certifierName: "Old Officer", effectiveFrom: "2025-01-01" }),
      row({ certifierName: "New Officer", effectiveFrom: "2026-06-01" }),
    ];
    expect(pickCertifier(rows, ["COE"], "2026-11-05")?.name).toBe(
      "New Officer",
    );
  });

  it("falls back to the linked employee's name and position", () => {
    const rows = [
      row({
        certifierName: null,
        certifierPosition: null,
        employee: {
          firstName: "Juan",
          middleName: "Reyes",
          lastName: "Dela Cruz",
          suffix: "Jr.",
          positionTitle: "Chief Administrative Officer",
        },
      }),
    ];
    expect(pickCertifier(rows, ["COE"], "2026-11-05")).toEqual({
      name: "Juan R. Dela Cruz Jr.",
      title: "Chief Administrative Officer",
    });
  });

  it("skips rows missing a position and honours code preference order", () => {
    const rows = [
      row({ documentTypeCode: "COE_REMUNERATION", certifierPosition: null }),
      row({ documentTypeCode: "coe", certifierName: "Generic COE Signer" }),
    ];
    expect(
      pickCertifier(rows, ["COE_REMUNERATION", "COER", "COE"], "2026-11-05")
        ?.name,
    ).toBe("Generic COE Signer");
  });
});
