/**
 * Tests for the day-context resolver (TOR 1.5.4 / 1.5.9).
 *
 * Coverage:
 * - resolveDayType: every holiday type × rest-day combination, special_working
 * - isRestDay / dayOfWeek: weekday matrix, invalid dates, timezone safety
 * - resolveSuspension: none / half / full / mixed / inactive / other-date
 */

import { describe, it, expect } from "vitest";
import {
  resolveDayType,
  isRestDay,
  dayOfWeek,
  resolveSuspension,
  type SuspensionEntry,
} from "./day-context";

// ---------------------------------------------------------------------------
// resolveDayType
// ---------------------------------------------------------------------------

describe("resolveDayType", () => {
  it("returns ordinary for a plain working day", () => {
    expect(resolveDayType({ date: "2026-07-15", isRestDay: false })).toBe(
      "ordinary",
    );
  });

  it("returns rest_day when no holiday and scheduled off", () => {
    expect(resolveDayType({ date: "2026-07-12", isRestDay: true })).toBe(
      "rest_day",
    );
  });

  it("returns regular_holiday on a regular holiday working-day", () => {
    expect(
      resolveDayType({
        date: "2026-06-12",
        holidayType: "regular",
        isRestDay: false,
      }),
    ).toBe("regular_holiday");
  });

  it("returns rest_day_and_regular_holiday when a regular holiday falls on a rest day", () => {
    expect(
      resolveDayType({
        date: "2026-06-12",
        holidayType: "regular",
        isRestDay: true,
      }),
    ).toBe("rest_day_and_regular_holiday");
  });

  it("returns special_non_working on a special non-working day", () => {
    expect(
      resolveDayType({
        date: "2026-08-21",
        holidayType: "special_non_working",
        isRestDay: false,
      }),
    ).toBe("special_non_working");
  });

  it("returns rest_day_and_special when a special day falls on a rest day", () => {
    expect(
      resolveDayType({
        date: "2026-08-21",
        holidayType: "special_non_working",
        isRestDay: true,
      }),
    ).toBe("rest_day_and_special");
  });

  it("treats special_working holidays as ordinary working days", () => {
    expect(
      resolveDayType({
        date: "2026-11-02",
        holidayType: "special_working",
        isRestDay: false,
      }),
    ).toBe("ordinary");
  });

  it("treats special_working on a rest day as rest_day (no holiday premium)", () => {
    expect(
      resolveDayType({
        date: "2026-11-01",
        holidayType: "special_working",
        isRestDay: true,
      }),
    ).toBe("rest_day");
  });

  it("treats null holidayType as no holiday", () => {
    expect(
      resolveDayType({
        date: "2026-07-15",
        holidayType: null,
        isRestDay: false,
      }),
    ).toBe("ordinary");
  });
});

// ---------------------------------------------------------------------------
// isRestDay / dayOfWeek
// ---------------------------------------------------------------------------

describe("dayOfWeek", () => {
  it("computes the correct day of week (0=Sun … 6=Sat)", () => {
    expect(dayOfWeek("2026-07-12")).toBe(0); // Sunday
    expect(dayOfWeek("2026-07-13")).toBe(1); // Monday
    expect(dayOfWeek("2026-07-14")).toBe(2); // Tuesday
    expect(dayOfWeek("2026-07-15")).toBe(3); // Wednesday
    expect(dayOfWeek("2026-07-16")).toBe(4); // Thursday
    expect(dayOfWeek("2026-07-17")).toBe(5); // Friday
    expect(dayOfWeek("2026-07-18")).toBe(6); // Saturday
  });

  it("throws on malformed input", () => {
    expect(() => dayOfWeek("07/15/2026")).toThrow(/Invalid date/);
    expect(() => dayOfWeek("2026-7-15")).toThrow(/Invalid date/);
    expect(() => dayOfWeek("")).toThrow(/Invalid date/);
  });

  it("throws on impossible calendar dates", () => {
    expect(() => dayOfWeek("2026-02-30")).toThrow(/Invalid calendar date/);
    expect(() => dayOfWeek("2026-13-01")).toThrow(/Invalid calendar date/);
  });
});

describe("isRestDay", () => {
  const MON_TO_FRI = [1, 2, 3, 4, 5];

  it("returns false for a weekday under a Mon–Fri schedule", () => {
    expect(isRestDay("2026-07-15", MON_TO_FRI)).toBe(false); // Wednesday
  });

  it("returns true for Saturday and Sunday under a Mon–Fri schedule", () => {
    expect(isRestDay("2026-07-18", MON_TO_FRI)).toBe(true); // Saturday
    expect(isRestDay("2026-07-12", MON_TO_FRI)).toBe(true); // Sunday
  });

  it("respects unusual schedules (Sun–Thu)", () => {
    const sunToThu = [0, 1, 2, 3, 4];
    expect(isRestDay("2026-07-12", sunToThu)).toBe(false); // Sunday works
    expect(isRestDay("2026-07-17", sunToThu)).toBe(true); // Friday off
    expect(isRestDay("2026-07-18", sunToThu)).toBe(true); // Saturday off
  });

  it("treats an empty applicableDays list as every day being a rest day", () => {
    expect(isRestDay("2026-07-15", [])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveSuspension
// ---------------------------------------------------------------------------

describe("resolveSuspension", () => {
  const fullTyphoon: SuspensionEntry = {
    applicableDate: "2026-07-15",
    applicableHours: "full",
    isActive: true,
  };
  const halfFamilyDay: SuspensionEntry = {
    applicableDate: "2026-07-15",
    applicableHours: "half",
    isActive: true,
  };

  it("returns not suspended when the list is empty", () => {
    expect(resolveSuspension([], "2026-07-15")).toEqual({
      isSuspended: false,
    });
  });

  it("returns not suspended when suspensions cover other dates only", () => {
    expect(
      resolveSuspension(
        [{ applicableDate: "2026-07-14", applicableHours: "full" }],
        "2026-07-15",
      ),
    ).toEqual({ isSuspended: false });
  });

  it("detects a full-day suspension", () => {
    expect(resolveSuspension([fullTyphoon], "2026-07-15")).toEqual({
      isSuspended: true,
      halfDay: false,
    });
  });

  it("detects a half-day suspension", () => {
    expect(resolveSuspension([halfFamilyDay], "2026-07-15")).toEqual({
      isSuspended: true,
      halfDay: true,
    });
  });

  it("full-day suspension wins over half-day on the same date", () => {
    expect(
      resolveSuspension([halfFamilyDay, fullTyphoon], "2026-07-15"),
    ).toEqual({ isSuspended: true, halfDay: false });
    // Order-independent
    expect(
      resolveSuspension([fullTyphoon, halfFamilyDay], "2026-07-15"),
    ).toEqual({ isSuspended: true, halfDay: false });
  });

  it("ignores inactive suspensions", () => {
    expect(
      resolveSuspension([{ ...fullTyphoon, isActive: false }], "2026-07-15"),
    ).toEqual({ isSuspended: false });
  });

  it("treats an omitted isActive flag as active", () => {
    expect(
      resolveSuspension(
        [{ applicableDate: "2026-07-15", applicableHours: "half" }],
        "2026-07-15",
      ),
    ).toEqual({ isSuspended: true, halfDay: true });
  });

  it("ignores unknown applicableHours values", () => {
    expect(
      resolveSuspension(
        [{ applicableDate: "2026-07-15", applicableHours: "quarter" }],
        "2026-07-15",
      ),
    ).toEqual({ isSuspended: false });
  });
});
