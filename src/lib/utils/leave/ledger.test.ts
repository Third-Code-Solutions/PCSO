import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db/transaction", () => ({
  lockKey: vi.fn(async () => undefined),
}));

import { ensureCreditRow, postLedgerEntry } from "./ledger";
import type { Tx } from "@/lib/db/transaction";

/** Minimal Drizzle stand-in: each select resolves the next queued result. */
function fakeTx(selectResults: unknown[][]) {
  const queue = [...selectResults];
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const chain = () => {
    const c = {
      from: () => c,
      where: () => c,
      orderBy: () => c,
      limit: async () => queue.shift() ?? [],
    };
    return c;
  };
  const tx = {
    select: () => chain(),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        inserts.push(v);
        return { onConflictDoNothing: async () => undefined };
      },
    }),
    update: () => ({
      set: (v: Record<string, unknown>) => ({
        where: async () => {
          updates.push(v);
        },
      }),
    }),
  };
  return { tx: tx as unknown as Tx, inserts, updates };
}

const row = (balance: string, usedCredits = "0", totalCredits = "0") => ({
  id: "row-1",
  balance,
  usedCredits,
  totalCredits,
});

describe("ensureCreditRow — year rollover (H-11)", () => {
  it("seeds a new year with the prior year's closing balance as carry-over", async () => {
    const { tx, inserts } = fakeTx([
      [],
      [{ balance: "12.500" }],
      [row("12.500")],
    ]);
    const seeded = await ensureCreditRow(tx, "emp", "vl", 2027, false);
    expect(inserts[0]).toMatchObject({
      year: 2027,
      balance: "12.500",
      carryOver: "12.500",
    });
    expect(seeded?.balance).toBe("12.500");
  });

  it("returns the existing row without seeding", async () => {
    const { tx, inserts } = fakeTx([[row("4")]]);
    expect((await ensureCreditRow(tx, "emp", "vl", 2026, true))?.balance).toBe(
      "4",
    );
    expect(inserts).toHaveLength(0);
  });

  it("returns null when no ledger exists and creation is not allowed", async () => {
    const { tx, inserts } = fakeTx([[], []]);
    expect(await ensureCreditRow(tx, "emp", "vl", 2026, false)).toBeNull();
    expect(inserts).toHaveLength(0);
  });

  it("opens a zero ledger when creation is allowed", async () => {
    const { tx, inserts } = fakeTx([[], [], [row("0")]]);
    await ensureCreditRow(tx, "emp", "vl", 2026, true);
    expect(inserts[0]).toMatchObject({ balance: "0", carryOver: "0" });
  });
});

describe("postLedgerEntry", () => {
  it("charges leave, tracks used credits and carries the change into later years", async () => {
    const { tx, updates } = fakeTx([[row("10", "2", "12")]]);
    const res = await postLedgerEntry(tx, {
      employeeId: "emp",
      leaveTypeId: "vl",
      year: 2026,
      delta: -3,
      kind: "use",
    });
    expect(res).toMatchObject({ previousBalance: 10, newBalance: 7 });
    expect(updates[0]).toMatchObject({ balance: "7", usedCredits: "5" });
    expect(updates[1]).toHaveProperty("balance");
    expect(updates[1]).toHaveProperty("carryOver");
  });

  it("restoring a charge lowers used credits", async () => {
    const { tx, updates } = fakeTx([[row("7", "5", "12")]]);
    await postLedgerEntry(tx, {
      employeeId: "emp",
      leaveTypeId: "vl",
      year: 2026,
      delta: 3,
      kind: "use",
    });
    expect(updates[0]).toMatchObject({ balance: "10", usedCredits: "2" });
  });

  it("accrual into a new year builds on the carried-over balance", async () => {
    const { tx, updates } = fakeTx([[], [{ balance: "5" }], [row("5")]]);
    const res = await postLedgerEntry(tx, {
      employeeId: "emp",
      leaveTypeId: "vl",
      year: 2027,
      delta: 1.25,
      kind: "earn",
    });
    expect(res.newBalance).toBe(6.25);
    expect(updates[0]).toMatchObject({ balance: "6.25", totalCredits: "1.25" });
  });

  it("refuses to go negative and writes nothing", async () => {
    const { tx, updates } = fakeTx([[row("1")]]);
    await expect(
      postLedgerEntry(tx, {
        employeeId: "emp",
        leaveTypeId: "vl",
        year: 2026,
        delta: -2,
        kind: "use",
      }),
    ).rejects.toBeInstanceOf(RangeError);
    expect(updates).toHaveLength(0);
  });

  it("refuses a charge when the employee has no ledger at all", async () => {
    const { tx } = fakeTx([[], []]);
    await expect(
      postLedgerEntry(tx, {
        employeeId: "emp",
        leaveTypeId: "vl",
        year: 2026,
        delta: -1,
        kind: "use",
      }),
    ).rejects.toThrow(/No leave credit record/);
  });
});
