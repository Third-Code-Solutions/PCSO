import { describe, it, expect } from "vitest";
import {
  candidateBreachesCap,
  evaluateOfficeForcedRanking,
  finalizableAdjectival,
  planningEditDenial,
  type PopulationRow,
} from "./rating-rules";

describe("finalizableAdjectival (H-28 phase gate)", () => {
  it("rejects a planning-submitted rating with the 0.000 placeholder", () => {
    expect(() =>
      finalizableAdjectival({ status: "submitted", numericalRating: 0 }),
    ).toThrow(/review-phase score/);
  });

  it("rejects non-submitted statuses", () => {
    expect(() =>
      finalizableAdjectival({ status: "reviewed", numericalRating: 4 }),
    ).toThrow(/Only submitted/);
  });

  it.each([
    [5, "outstanding"],
    [4.5, "outstanding"],
    [4.499, "very_satisfactory"],
    [3.5, "very_satisfactory"],
    [2.5, "satisfactory"],
    [1.5, "unsatisfactory"],
    [1.0, "poor"],
  ])("derives %s -> %s per §10.4.1", (n, expected) => {
    expect(
      finalizableAdjectival({ status: "submitted", numericalRating: n }),
    ).toBe(expected);
  });
});

function rows(scores: number[], status = "submitted"): PopulationRow[] {
  return scores.map((n, i) => ({ id: `r${i}`, status, numericalRating: n }));
}

describe("evaluateOfficeForcedRanking (H-29)", () => {
  it("counts unrated IPCRFs in the denominator so early O ratings are not blocked", () => {
    // 20-person office, only 1 rated so far: 10% of 20 = 2 Outstanding allowed.
    const population = rows(Array(19).fill(0), "draft");
    population.push({ id: "o1", status: "submitted", numericalRating: 4.8 });
    const result = evaluateOfficeForcedRanking(population, {
      id: "cand",
      numericalRating: 4.7,
    });
    expect(result.valid).toBe(true);
    expect(result.totalPopulation).toBe(21);
  });

  it("blocks a third Outstanding in a 20-person office", () => {
    const population = [
      ...rows(Array(17).fill(3)),
      { id: "o1", status: "approved", numericalRating: 4.9 },
      { id: "o2", status: "submitted", numericalRating: 4.6 },
    ];
    const result = evaluateOfficeForcedRanking(population, {
      id: "cand",
      numericalRating: 4.5,
    });
    expect(result.valid).toBe(false);
    expect(candidateBreachesCap(result, 4.5)).toBe(true);
  });

  it("is order-independent: same set gives same verdict regardless of approval status", () => {
    const a = evaluateOfficeForcedRanking(
      [
        { id: "x", status: "approved", numericalRating: 4.6 },
        { id: "y", status: "submitted", numericalRating: 3 },
      ],
      { id: "z", numericalRating: 4.6 },
    );
    const b = evaluateOfficeForcedRanking(
      [
        { id: "x", status: "submitted", numericalRating: 4.6 },
        { id: "y", status: "approved", numericalRating: 3 },
      ],
      { id: "z", numericalRating: 4.6 },
    );
    expect(a).toEqual(b);
    expect(a.valid).toBe(false);
  });

  it("uses the candidate's new score instead of its stored row", () => {
    const result = evaluateOfficeForcedRanking(
      [
        { id: "cand", status: "submitted", numericalRating: 4.9 },
        { id: "o1", status: "submitted", numericalRating: 4.9 },
        ...rows([3, 3, 3]),
      ],
      { id: "cand", numericalRating: 3 },
    );
    expect(result.outstandingCount).toBe(1);
    expect(result.totalPopulation).toBe(5);
    expect(result.valid).toBe(true);
  });

  it("ignores disapproved ratings", () => {
    const result = evaluateOfficeForcedRanking(
      [{ id: "d", status: "disapproved", numericalRating: 4.9 }],
      { id: "cand", numericalRating: 4.9 },
    );
    expect(result.valid).toBe(true);
    expect(result.totalPopulation).toBe(1);
  });

  it("a Satisfactory candidate never breaches an O/VS cap", () => {
    const result = evaluateOfficeForcedRanking(rows([4.9, 4.9]), {
      id: "cand",
      numericalRating: 3,
    });
    expect(result.valid).toBe(false);
    expect(candidateBreachesCap(result, 3)).toBe(false);
  });
});

describe("planningEditDenial (H-27)", () => {
  const target = {
    employeeId: "emp-1",
    rateeOfficeId: "office-a",
    status: "draft",
    numericalRating: 0,
  };

  it("lets the ratee edit their own draft", () => {
    expect(
      planningEditDenial(
        {
          role: "employee_self_service",
          employeeId: "emp-1",
          officeId: "office-a",
        },
        target,
      ),
    ).toBeNull();
  });

  it("locks the ratee out once submitted", () => {
    expect(
      planningEditDenial(
        {
          role: "employee_self_service",
          employeeId: "emp-1",
          officeId: "office-a",
        },
        { ...target, status: "submitted" },
      ),
    ).not.toBeNull();
  });

  it("denies another employee", () => {
    expect(
      planningEditDenial(
        {
          role: "employee_self_service",
          employeeId: "emp-2",
          officeId: "office-a",
        },
        target,
      ),
    ).toMatch(/Forbidden/);
  });

  it.each(["auditor", "executive", "viewer"] as const)(
    "denies read-only profile %s",
    (role) => {
      expect(
        planningEditDenial({ role, employeeId: null, officeId: null }, target),
      ).toMatch(/Forbidden/);
    },
  );

  it("lets a supervisor in the ratee's office edit a submitted plan", () => {
    expect(
      planningEditDenial(
        { role: "supervisor", employeeId: "sup-1", officeId: "office-a" },
        { ...target, status: "submitted" },
      ),
    ).toBeNull();
    expect(
      planningEditDenial(
        { role: "leave_approver", employeeId: "sup-1", officeId: "office-a" },
        target,
      ),
    ).toBeNull();
  });

  it("denies a supervisor from another office", () => {
    expect(
      planningEditDenial(
        { role: "supervisor", employeeId: "sup-2", officeId: "office-b" },
        target,
      ),
    ).toMatch(/Forbidden/);
  });

  it("lets HR edit but not after a review rating exists", () => {
    const hr = { role: "hr_admin" as const, employeeId: null, officeId: null };
    expect(
      planningEditDenial(hr, { ...target, status: "submitted" }),
    ).toBeNull();
    expect(
      planningEditDenial(hr, {
        ...target,
        status: "submitted",
        numericalRating: 4.2,
      }),
    ).toMatch(/locked/);
    expect(
      planningEditDenial(hr, { ...target, status: "reviewed" }),
    ).not.toBeNull();
  });
});
