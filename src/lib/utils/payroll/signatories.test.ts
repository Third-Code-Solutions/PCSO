/**
 * Payroll signatory chain resolution tests — TOR 1.8.6.
 * Pure logic — no database, no env.
 */

import { describe, it, expect } from "vitest";
import {
  resolveSignatoryChain,
  DEFAULT_PAYROLL_REGISTER_SIGNATORIES,
  type SignatoryChainRow,
} from "./signatories";

describe("resolveSignatoryChain", () => {
  it("falls back to the default 3-slot chain when no rows are configured", () => {
    expect(resolveSignatoryChain([])).toEqual(
      DEFAULT_PAYROLL_REGISTER_SIGNATORIES,
    );
    expect(resolveSignatoryChain(null)).toEqual(
      DEFAULT_PAYROLL_REGISTER_SIGNATORIES,
    );
    expect(resolveSignatoryChain(undefined)).toEqual(
      DEFAULT_PAYROLL_REGISTER_SIGNATORIES,
    );
  });

  it("default chain is Prepared/Certified/Approved with the TOR titles", () => {
    const captions = DEFAULT_PAYROLL_REGISTER_SIGNATORIES.map((s) => s.caption);
    const titles = DEFAULT_PAYROLL_REGISTER_SIGNATORIES.map((s) => s.title);

    expect(captions).toEqual(["Prepared by", "Certified by", "Approved by"]);
    expect(titles).toEqual([
      "Payroll Officer",
      "HRD Manager",
      "General Manager",
    ]);
  });

  it("sorts configured rows by sequence order", () => {
    const rows: SignatoryChainRow[] = [
      { signatoryRole: "approved_by", signatoryTitle: "GM", sequenceOrder: 3 },
      { signatoryRole: "prepared_by", signatoryTitle: "PO", sequenceOrder: 1 },
      { signatoryRole: "certified_by", signatoryTitle: "HM", sequenceOrder: 2 },
    ];

    const chain = resolveSignatoryChain(rows);

    expect(chain.map((s) => s.title)).toEqual(["PO", "HM", "GM"]);
    expect(chain.map((s) => s.sequenceOrder)).toEqual([1, 2, 3]);
  });

  it("maps known role codes to captions regardless of casing", () => {
    const rows: SignatoryChainRow[] = [
      {
        signatoryRole: "PREPARED_BY",
        signatoryTitle: "Payroll Officer III",
        sequenceOrder: 1,
      },
      {
        signatoryRole: " noted_by ",
        signatoryTitle: "Division Chief",
        sequenceOrder: 2,
      },
    ];

    const chain = resolveSignatoryChain(rows);

    expect(chain[0]!.caption).toBe("Prepared by");
    expect(chain[1]!.caption).toBe("Noted by");
  });

  it("falls back to positional captions for unrecognized role codes", () => {
    const rows: SignatoryChainRow[] = [
      {
        signatoryRole: "division_chief",
        signatoryTitle: "DC",
        sequenceOrder: 1,
      },
      {
        signatoryRole: "budget_officer",
        signatoryTitle: "BO",
        sequenceOrder: 2,
      },
      { signatoryRole: "gm_office", signatoryTitle: "GM", sequenceOrder: 3 },
      {
        signatoryRole: "board_liaison",
        signatoryTitle: "BL",
        sequenceOrder: 4,
      },
    ];

    const chain = resolveSignatoryChain(rows);

    expect(chain.map((s) => s.caption)).toEqual([
      "Prepared by",
      "Certified by",
      "Approved by",
      "Signatory 4",
    ]);
  });

  it("supports chains shorter or longer than the default 3 slots", () => {
    const single = resolveSignatoryChain([
      {
        signatoryRole: "approved_by",
        signatoryTitle: "General Manager",
        sequenceOrder: 1,
      },
    ]);
    expect(single).toHaveLength(1);
    expect(single[0]!.caption).toBe("Approved by");

    const five = resolveSignatoryChain(
      [1, 2, 3, 4, 5].map((n) => ({
        signatoryRole: `slot_${n}`,
        signatoryTitle: `Title ${n}`,
        sequenceOrder: n,
      })),
    );
    expect(five).toHaveLength(5);
    expect(five[4]!.caption).toBe("Signatory 5");
  });

  it("does not mutate the input rows", () => {
    const rows: SignatoryChainRow[] = [
      { signatoryRole: "approved_by", signatoryTitle: "GM", sequenceOrder: 2 },
      { signatoryRole: "prepared_by", signatoryTitle: "PO", sequenceOrder: 1 },
    ];
    const snapshot = rows.map((r) => ({ ...r }));

    resolveSignatoryChain(rows);

    expect(rows).toEqual(snapshot);
  });
});
