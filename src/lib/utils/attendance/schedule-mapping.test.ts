import { describe, expect, it } from "vitest";

import { DEFAULT_AGENCY_SCHEDULE } from "@/lib/constants/work-schedule";
import {
  breakMinutes,
  toComputeSchedule,
  toTimeString,
} from "./schedule-mapping";

describe("toTimeString", () => {
  it("formats local time with zero padding", () => {
    // Arrange
    const value = new Date(2026, 5, 15, 8, 5); // 08:05 local

    // Act
    const result = toTimeString(value);

    // Assert
    expect(result).toBe("08:05");
  });

  it("returns null for null or undefined", () => {
    expect(toTimeString(null)).toBeNull();
    expect(toTimeString(undefined)).toBeNull();
  });

  it("returns null for an invalid Date", () => {
    expect(toTimeString(new Date("not-a-date"))).toBeNull();
  });
});

describe("breakMinutes", () => {
  it("computes a standard lunch break", () => {
    expect(breakMinutes("12:00", "13:00")).toBe(60);
  });

  it("handles HH:MM:SS values from time columns", () => {
    expect(breakMinutes("12:00:00", "12:30:00")).toBe(30);
  });

  it("returns 0 when either bound is missing", () => {
    expect(breakMinutes(null, "13:00")).toBe(0);
    expect(breakMinutes("12:00", null)).toBe(0);
    expect(breakMinutes(null, null)).toBe(0);
  });

  it("returns 0 when a bound is malformed", () => {
    expect(breakMinutes("noon", "13:00")).toBe(0);
    expect(breakMinutes("12:00", "25:99")).toBe(0);
  });

  it("wraps past midnight for overnight breaks", () => {
    expect(breakMinutes("23:30", "00:30")).toBe(60);
  });
});

describe("toComputeSchedule", () => {
  it("maps a work_schedules row to the compute shape", () => {
    // Arrange
    const row = {
      timeIn: "09:00:00",
      timeOut: "18:00:00",
      breakStart: "12:00:00",
      breakEnd: "13:00:00",
      gracePeriodMinutes: 15,
    };

    // Act
    const result = toComputeSchedule(row);

    // Assert
    expect(result).toEqual({
      scheduledStart: "09:00:00",
      scheduledEnd: "18:00:00",
      lunchBreakMinutes: 60,
      gracePeriodMinutes: 15,
    });
  });

  it("uses 0 break minutes when the schedule has no break window", () => {
    const result = toComputeSchedule({
      timeIn: "08:00",
      timeOut: "17:00",
      breakStart: null,
      breakEnd: null,
      gracePeriodMinutes: 0,
    });

    expect(result.lunchBreakMinutes).toBe(0);
  });

  it("falls back to the default agency schedule when no row exists", () => {
    expect(toComputeSchedule(null)).toEqual(DEFAULT_AGENCY_SCHEDULE);
    expect(toComputeSchedule(undefined)).toEqual(DEFAULT_AGENCY_SCHEDULE);
  });
});
