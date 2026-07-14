/**
 * Tests for biometric payload parsing (TOR 1.5.2) and punch folding
 * (TOR 1.5.6 lunch TITO).
 *
 * Security coverage: XML DOCTYPE / ENTITY rejection (SEC 3.2.9).
 */

import { describe, it, expect } from "vitest";
import {
  splitTimestamp,
  normalizePunch,
  parsePunchRecords,
  parsePunchCsv,
  parsePunchXml,
  foldPunchesToDayRows,
  type DevicePunch,
} from "./biometric-payload";

function punch(
  badgeId: string,
  date: string,
  time: string,
  recordType: "in" | "out",
): DevicePunch {
  return { badgeId, date, time, recordType, rawTimestamp: `${date} ${time}` };
}

// ---------------------------------------------------------------------------
// splitTimestamp
// ---------------------------------------------------------------------------

describe("splitTimestamp", () => {
  it("parses space-separated timestamps", () => {
    expect(splitTimestamp("2026-07-15 08:01")).toEqual({
      date: "2026-07-15",
      time: "08:01",
    });
    expect(splitTimestamp("2026-07-15 08:01:33")).toEqual({
      date: "2026-07-15",
      time: "08:01",
    });
  });

  it("parses ISO-8601 timestamps, ignoring the zone suffix (wall-clock)", () => {
    expect(splitTimestamp("2026-07-15T17:30:00Z")).toEqual({
      date: "2026-07-15",
      time: "17:30",
    });
    expect(splitTimestamp("2026-07-15T17:30:00+08:00")).toEqual({
      date: "2026-07-15",
      time: "17:30",
    });
  });

  it("rejects malformed or out-of-range values", () => {
    expect(splitTimestamp("15/07/2026 08:00")).toBeNull();
    expect(splitTimestamp("2026-07-15")).toBeNull();
    expect(splitTimestamp("2026-13-15 08:00")).toBeNull();
    expect(splitTimestamp("2026-07-15 25:00")).toBeNull();
    expect(splitTimestamp("2026-07-15 08:61")).toBeNull();
    expect(splitTimestamp("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizePunch
// ---------------------------------------------------------------------------

describe("normalizePunch", () => {
  it("normalizes a valid record and record-type variants", () => {
    const ok = normalizePunch({
      badgeId: "1042",
      timestamp: "2026-07-15 08:01",
      recordType: "IN",
    });
    expect(ok).toEqual({
      punch: {
        badgeId: "1042",
        date: "2026-07-15",
        time: "08:01",
        recordType: "in",
        rawTimestamp: "2026-07-15 08:01",
      },
    });

    const out = normalizePunch({
      badgeId: 77,
      timestamp: "2026-07-15T17:00:00",
      recordType: "check-out",
    });
    expect("punch" in out && out.punch.recordType).toBe("out");
  });

  it("rejects missing badge, bad timestamp, and unknown record type", () => {
    expect(
      normalizePunch({
        badgeId: "",
        timestamp: "2026-07-15 08:00",
        recordType: "in",
      }),
    ).toHaveProperty("error");
    expect(
      normalizePunch({
        badgeId: "1",
        timestamp: "yesterday",
        recordType: "in",
      }),
    ).toHaveProperty("error");
    expect(
      normalizePunch({
        badgeId: "1",
        timestamp: "2026-07-15 08:00",
        recordType: "sideways",
      }),
    ).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------
// parsePunchRecords (JSON)
// ---------------------------------------------------------------------------

describe("parsePunchRecords", () => {
  it("accepts snake_case field variants and collects per-record errors", () => {
    const { punches, errors } = parsePunchRecords([
      { badge_id: "1042", timestamp: "2026-07-15 08:01", record_type: "in" },
      { badgeId: "1042", datetime: "2026-07-15 17:02", type: "out" },
      { badgeId: "9999" }, // missing timestamp
      "not-an-object",
    ]);
    expect(punches).toHaveLength(2);
    expect(punches[0]?.badgeId).toBe("1042");
    expect(punches[1]?.recordType).toBe("out");
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.index)).toEqual([3, 4]);
  });
});

// ---------------------------------------------------------------------------
// parsePunchCsv
// ---------------------------------------------------------------------------

describe("parsePunchCsv", () => {
  it("parses a punch CSV with vendor header variants", () => {
    const csv = [
      "Badge_ID,Timestamp,Record_Type",
      "1042,2026-07-15 08:01,in",
      '"1043","2026-07-15 08:15","out"',
    ].join("\r\n");
    const { punches, errors } = parsePunchCsv(csv);
    expect(errors).toHaveLength(0);
    expect(punches).toEqual([
      punch("1042", "2026-07-15", "08:01", "in"),
      {
        ...punch("1043", "2026-07-15", "08:15", "out"),
        rawTimestamp: "2026-07-15 08:15",
      },
    ]);
  });

  it("reports missing required headers", () => {
    const { punches, errors } = parsePunchCsv("a,b,c\n1,2,3");
    expect(punches).toHaveLength(0);
    expect(errors[0]?.message).toMatch(/badge_id, timestamp/);
  });

  it("reports row-level errors with 1-based line numbers", () => {
    const csv = ["badge_id,timestamp,record_type", "1042,BAD,in"].join("\n");
    const { punches, errors } = parsePunchCsv(csv);
    expect(punches).toHaveLength(0);
    expect(errors).toEqual([
      { index: 2, message: expect.stringContaining("Invalid timestamp") },
    ]);
  });

  it("rejects an empty payload", () => {
    expect(parsePunchCsv("").errors).toHaveLength(1);
    expect(parsePunchCsv("badge_id,timestamp,record_type").errors).toHaveLength(
      1,
    );
  });
});

// ---------------------------------------------------------------------------
// parsePunchXml
// ---------------------------------------------------------------------------

describe("parsePunchXml", () => {
  const validXml = `<?xml version="1.0"?>
    <records>
      <record>
        <badgeId>1042</badgeId>
        <timestamp>2026-07-15 08:01</timestamp>
        <recordType>in</recordType>
      </record>
      <record>
        <badge_id>1042</badge_id>
        <timestamp>2026-07-15T17:02:00+08:00</timestamp>
        <record_type>out</record_type>
      </record>
    </records>`;

  it("extracts records including snake_case tag variants", () => {
    const { punches, errors } = parsePunchXml(validXml);
    expect(errors).toHaveLength(0);
    expect(punches).toHaveLength(2);
    expect(punches[0]).toMatchObject({
      badgeId: "1042",
      date: "2026-07-15",
      time: "08:01",
      recordType: "in",
    });
    expect(punches[1]).toMatchObject({ time: "17:02", recordType: "out" });
  });

  it("decodes basic XML entities in values", () => {
    const xml = `<records><record><badgeId>A&amp;B</badgeId><timestamp>2026-07-15 08:00</timestamp><recordType>in</recordType></record></records>`;
    const { punches } = parsePunchXml(xml);
    expect(punches[0]?.badgeId).toBe("A&B");
  });

  it("REJECTS payloads containing a DOCTYPE declaration (XXE guard)", () => {
    const evil = `<?xml version="1.0"?>
      <!DOCTYPE records [<!ELEMENT records ANY>]>
      <records><record><badgeId>1</badgeId><timestamp>2026-07-15 08:00</timestamp><recordType>in</recordType></record></records>`;
    const { punches, errors } = parsePunchXml(evil);
    expect(punches).toHaveLength(0);
    expect(errors[0]?.message).toMatch(/DOCTYPE or ENTITY/);
  });

  it("REJECTS payloads containing ENTITY declarations (billion-laughs guard)", () => {
    const evil = `<!ENTITY x "boom"><records><record><badgeId>&x;</badgeId><timestamp>2026-07-15 08:00</timestamp><recordType>in</recordType></record></records>`;
    const { punches, errors } = parsePunchXml(evil);
    expect(punches).toHaveLength(0);
    expect(errors[0]?.message).toMatch(/DOCTYPE or ENTITY/);
  });

  it("rejects case-variant doctype declarations too", () => {
    const evil = `<!doctype records><records></records>`;
    expect(parsePunchXml(evil).errors[0]?.message).toMatch(/DOCTYPE or ENTITY/);
  });

  it("reports an error when no record elements exist", () => {
    const { errors } = parsePunchXml("<records></records>");
    expect(errors[0]?.message).toMatch(/No <record> elements/);
  });

  it("collects per-record errors for incomplete records", () => {
    const xml = `<records><record><badgeId>1</badgeId></record></records>`;
    const { errors } = parsePunchXml(xml);
    expect(errors).toEqual([
      { index: 1, message: expect.stringContaining("Invalid timestamp") },
    ]);
  });
});

// ---------------------------------------------------------------------------
// foldPunchesToDayRows
// ---------------------------------------------------------------------------

describe("foldPunchesToDayRows", () => {
  it("folds a simple in/out pair into a 2-punch day row", () => {
    const rows = foldPunchesToDayRows([
      punch("1042", "2026-07-15", "08:01", "in"),
      punch("1042", "2026-07-15", "17:02", "out"),
    ]);
    expect(rows).toEqual([
      {
        badgeId: "1042",
        date: "2026-07-15",
        timeIn: "08:01",
        timeOut: "17:02",
        timeInPm: null,
        timeOutPm: null,
      },
    ]);
  });

  it("folds four punches into AM + PM sessions (lunch TITO)", () => {
    const rows = foldPunchesToDayRows([
      punch("1042", "2026-07-15", "12:01", "out"), // lunch out
      punch("1042", "2026-07-15", "08:00", "in"), // AM arrival
      punch("1042", "2026-07-15", "17:00", "out"), // PM departure
      punch("1042", "2026-07-15", "12:58", "in"), // lunch return
    ]);
    expect(rows).toEqual([
      {
        badgeId: "1042",
        date: "2026-07-15",
        timeIn: "08:00",
        timeOut: "12:01",
        timeInPm: "12:58",
        timeOutPm: "17:00",
      },
    ]);
  });

  it("keeps earliest-in / latest-out with duplicate punches (double-tap)", () => {
    const rows = foldPunchesToDayRows([
      punch("1042", "2026-07-15", "08:00", "in"),
      punch("1042", "2026-07-15", "08:01", "in"), // double-tap on entry
      punch("1042", "2026-07-15", "17:00", "out"),
    ]);
    expect(rows[0]).toMatchObject({
      timeIn: "08:00",
      timeOut: "17:00",
      timeInPm: null,
      timeOutPm: null,
    });
  });

  it("degrades chronologically-inconsistent 4-punch groups to a 2-punch pair", () => {
    // Two ins and two outs but the second "in" precedes the first "out".
    const rows = foldPunchesToDayRows([
      punch("1042", "2026-07-15", "08:00", "in"),
      punch("1042", "2026-07-15", "08:05", "in"),
      punch("1042", "2026-07-15", "12:00", "out"),
      punch("1042", "2026-07-15", "17:00", "out"),
    ]);
    expect(rows[0]).toMatchObject({
      timeIn: "08:00",
      timeOut: "17:00",
      timeInPm: null,
      timeOutPm: null,
    });
  });

  it("handles out-only records (missed clock-in)", () => {
    const rows = foldPunchesToDayRows([
      punch("1042", "2026-07-15", "17:00", "out"),
    ]);
    expect(rows[0]).toMatchObject({ timeIn: null, timeOut: "17:00" });
  });

  it("groups by badge and date, sorted by date then badge", () => {
    const rows = foldPunchesToDayRows([
      punch("B2", "2026-07-16", "08:00", "in"),
      punch("B1", "2026-07-16", "08:00", "in"),
      punch("B1", "2026-07-15", "08:00", "in"),
      punch("B1", "2026-07-15", "17:00", "out"),
    ]);
    expect(rows.map((r) => `${r.badgeId} ${r.date}`)).toEqual([
      "B1 2026-07-15",
      "B1 2026-07-16",
      "B2 2026-07-16",
    ]);
  });
});
