import { describe, it, expect } from "vitest";
import {
  buildDtrDays,
  daysInMonth,
  scheduleLabel,
  to12Hour,
  type DtrCalendarInput,
  type DtrLogInput,
} from "./dtr-calendar";
import { isRestDay } from "./day-context";

const log = (date: string, over: Partial<DtrLogInput> = {}): DtrLogInput => ({
  date,
  timeIn: null,
  timeOut: null,
  timeInPm: null,
  timeOutPm: null,
  lateMinutes: 0,
  undertimeMinutes: 0,
  remarks: null,
  ...over,
});

// November 2026: Nov 1 = Sunday, Nov 7 = Saturday.
const base = (over: Partial<DtrCalendarInput> = {}): DtrCalendarInput => ({
  year: 2026,
  month: 11,
  logs: [],
  holidays: [],
  leaves: [],
  suspensions: [],
  isRestDay: (d) => isRestDay(d, [1, 2, 3, 4, 5]),
  ...over,
});

const day = (rows: ReturnType<typeof buildDtrDays>, n: number) => {
  const found = rows.find((r) => r.day === n);
  if (!found) throw new Error(`day ${n} missing`);
  return found;
};

describe("daysInMonth", () => {
  it("handles 30/31-day months and leap Februaries", () => {
    expect(daysInMonth(2026, 11)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
  });
});

describe("buildDtrDays (H-40)", () => {
  it("emits one row per real calendar day", () => {
    expect(buildDtrDays(base())).toHaveLength(30);
    expect(buildDtrDays(base({ year: 2028, month: 2 }))).toHaveLength(29);
  });

  it("marks weekends from the employee's schedule", () => {
    const rows = buildDtrDays(base());
    expect(day(rows, 1).marker).toBe("SUNDAY");
    expect(day(rows, 7).marker).toBe("SATURDAY");
    expect(day(rows, 2).marker).toBeNull();
  });

  it("uses REST DAY for a weekday outside a custom schedule", () => {
    // Tue–Sat schedule: Monday Nov 2 is a rest day, Saturday Nov 7 is not.
    const rows = buildDtrDays(
      base({ isRestDay: (d) => isRestDay(d, [2, 3, 4, 5, 6]) }),
    );
    expect(day(rows, 2).marker).toBe("REST DAY");
    expect(day(rows, 7).marker).toBeNull();
  });

  it("marks holidays, approved leave and full suspensions", () => {
    const rows = buildDtrDays(
      base({
        holidays: [
          { date: "2026-11-30", name: "Bonifacio Day", type: "regular" },
          {
            date: "2026-11-03",
            name: "Special Working",
            type: "special_working",
          },
        ],
        leaves: [
          {
            dateFrom: "2026-11-04",
            dateTo: "2026-11-09",
            label: "Vacation Leave",
          },
        ],
        suspensions: [
          { applicableDate: "2026-11-10", applicableHours: "full" },
        ],
      }),
    );
    expect(day(rows, 30).marker).toBe("BONIFACIO DAY");
    expect(day(rows, 3).marker).toBeNull(); // special working = ordinary day
    expect(day(rows, 4).marker).toBe("VACATION LEAVE");
    expect(day(rows, 7).marker).toBe("SATURDAY"); // rest day beats leave span
    expect(day(rows, 10).marker).toBe("WORK SUSPENDED");
  });

  it("marks ABSENT only when a log exists without punches", () => {
    const rows = buildDtrDays(base({ logs: [log("2026-11-11")] }));
    expect(day(rows, 11).marker).toBe("ABSENT");
    expect(day(rows, 12).marker).toBeNull();
  });

  it("maps a 4-punch day directly onto the Form 48 columns", () => {
    const rows = buildDtrDays(
      base({
        logs: [
          log("2026-11-02", {
            timeIn: "07:55:00",
            timeOut: "12:01:00",
            timeInPm: "12:58:00",
            timeOutPm: "17:02:00",
            lateMinutes: 5,
            undertimeMinutes: 10,
          }),
        ],
      }),
    );
    expect(day(rows, 2)).toMatchObject({
      amArrival: "07:55:00",
      amDeparture: "12:01:00",
      pmArrival: "12:58:00",
      pmDeparture: "17:02:00",
      undertimeMinutes: 15,
      marker: null,
    });
  });

  it("splits a 2-punch day into AM arrival + PM departure (no fake noon punches)", () => {
    const rows = buildDtrDays(
      base({
        logs: [log("2026-11-02", { timeIn: "08:00:00", timeOut: "17:00:00" })],
      }),
    );
    expect(day(rows, 2)).toMatchObject({
      amArrival: "08:00:00",
      amDeparture: null,
      pmArrival: null,
      pmDeparture: "17:00:00",
    });
  });

  it("keeps punches on a holiday and notes the holiday in remarks", () => {
    const rows = buildDtrDays(
      base({
        holidays: [
          { date: "2026-11-30", name: "Bonifacio Day", type: "regular" },
        ],
        logs: [log("2026-11-30", { timeIn: "08:00:00", timeOut: "12:00:00" })],
      }),
    );
    expect(day(rows, 30)).toMatchObject({
      marker: null,
      amArrival: "08:00:00",
      amDeparture: "12:00:00",
      remarks: "BONIFACIO DAY",
    });
  });

  it("notes a half-day suspension without hiding punches", () => {
    const rows = buildDtrDays(
      base({
        suspensions: [
          { applicableDate: "2026-11-12", applicableHours: "half" },
        ],
        logs: [log("2026-11-12", { timeIn: "08:00:00", timeOut: "12:00:00" })],
      }),
    );
    expect(day(rows, 12).remarks).toBe("HALF-DAY SUSPENSION");
  });
});

describe("to12Hour / scheduleLabel", () => {
  it("formats times", () => {
    expect(to12Hour("00:15:00")).toBe("12:15 AM");
    expect(to12Hour("12:00")).toBe("12:00 PM");
    expect(to12Hour("17:30:00")).toBe("5:30 PM");
    expect(to12Hour(null)).toBe("");
  });

  it("lists each distinct schedule once", () => {
    expect(
      scheduleLabel([
        { timeIn: "08:00:00", timeOut: "17:00:00" },
        { timeIn: "08:00", timeOut: "17:00" },
        { timeIn: "07:00:00", timeOut: "16:00:00" },
      ]),
    ).toBe("8:00 AM – 5:00 PM; 7:00 AM – 4:00 PM");
  });
});
