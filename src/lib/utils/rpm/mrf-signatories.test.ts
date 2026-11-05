import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/schema/employees", () => ({ employees: {} }));
vi.mock("@/lib/db/schema/fm-extensions", () => ({ fmDocumentSignatories: {} }));
vi.mock("@/lib/db/schema/offices", () => ({ offices: {} }));

import { resolveMrfApprovers } from "./mrf-signatories";

const CHAIN = [
  { signatoryRole: "gm", signatoryTitle: "General Manager", sequenceOrder: 30 },
  {
    signatoryRole: "dept_head",
    signatoryTitle: "Department Head",
    sequenceOrder: 10,
  },
  {
    signatoryRole: "agm",
    signatoryTitle: "Assistant General Manager",
    sequenceOrder: 20,
  },
];

// division → sector → head office
const OFFICES = [
  { id: "div", parentId: "sector", headEmployeeId: null },
  { id: "sector", parentId: "ho", headEmployeeId: "e-sector-head" },
  { id: "ho", parentId: null, headEmployeeId: "e-gm" },
  { id: "other-sector", parentId: "ho", headEmployeeId: "e-other-head" },
];

const EMPLOYEES = [
  { id: "e-gm", positionTitle: "General Manager", officeId: "ho" },
  {
    id: "e-agm-1",
    positionTitle: "Assistant General Manager",
    officeId: "sector",
  },
  {
    id: "e-agm-2",
    positionTitle: " assistant general manager ",
    officeId: "other-sector",
  },
];

describe("resolveMrfApprovers", () => {
  it("orders by FM sequence, renumbers 1..n and resolves each role", () => {
    const result = resolveMrfApprovers({
      rows: CHAIN,
      mrfOfficeId: "div",
      offices: OFFICES,
      employees: EMPLOYEES,
    });
    expect(result).toEqual({
      ok: true,
      approvers: [
        {
          approverRole: "dept_head",
          approverEmployeeId: "e-sector-head",
          sequenceOrder: 1,
        },
        // two AGMs: the one in the requesting office's hierarchy wins
        {
          approverRole: "agm",
          approverEmployeeId: "e-agm-1",
          sequenceOrder: 2,
        },
        { approverRole: "gm", approverEmployeeId: "e-gm", sequenceOrder: 3 },
      ],
    });
  });

  it("fails with an actionable message when no chain is configured", () => {
    const result = resolveMrfApprovers({
      rows: [],
      mrfOfficeId: "div",
      offices: OFFICES,
      employees: EMPLOYEES,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Document Signatories/);
  });

  it("fails when no office up the hierarchy has a head", () => {
    const result = resolveMrfApprovers({
      rows: [CHAIN[1]!],
      mrfOfficeId: "div",
      offices: OFFICES.map((o) => ({ ...o, headEmployeeId: null })),
      employees: EMPLOYEES,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Admin → Offices/);
  });

  it("fails when no employee holds the signatory title", () => {
    const result = resolveMrfApprovers({
      rows: [CHAIN[0]!],
      mrfOfficeId: "div",
      offices: OFFICES,
      employees: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/"General Manager"/);
  });

  it("fails when duplicate titles cannot be disambiguated", () => {
    const result = resolveMrfApprovers({
      rows: [CHAIN[2]!],
      mrfOfficeId: "other-sector-child",
      offices: OFFICES,
      employees: [
        { id: "a", positionTitle: "Assistant General Manager", officeId: "x" },
        { id: "b", positionTitle: "Assistant General Manager", officeId: "y" },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/2 active employees/);
  });

  it("survives a cyclic office hierarchy", () => {
    const result = resolveMrfApprovers({
      rows: [CHAIN[1]!],
      mrfOfficeId: "a",
      offices: [
        { id: "a", parentId: "b", headEmployeeId: null },
        { id: "b", parentId: "a", headEmployeeId: null },
      ],
      employees: [],
    });
    expect(result.ok).toBe(false);
  });
});
