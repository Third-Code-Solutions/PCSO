/**
 * Biometric device payload parsing — TOR 1.5.2 (TAM-004).
 *
 * Parses raw BFR device exports (CSV / JSON / XML) into normalized punch
 * events, and folds punch events into per-(badge, date) day rows compatible
 * with the shared attendance ingest pipeline.
 *
 * Security (TOR SEC 3.2.9): the XML path is a minimal well-formed-subset
 * extractor with NO DTD or entity processing. Payloads containing
 * `<!DOCTYPE` or `<!ENTITY` are rejected outright, which structurally
 * eliminates XXE and billion-laughs vectors — nothing is ever resolved,
 * fetched, or expanded.
 *
 * No DB imports. All inputs are plain values, per the attendance utils
 * convention.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PunchRecordType = "in" | "out";

/** One normalized punch event from a device payload. */
export interface DevicePunch {
  badgeId: string;
  /** YYYY-MM-DD (device wall-clock) */
  date: string;
  /** HH:MM (device wall-clock) */
  time: string;
  recordType: PunchRecordType;
  /** Original timestamp string as received, for raw-record archival. */
  rawTimestamp: string;
}

export interface PayloadParseError {
  /** 1-based record/line index within the payload */
  index: number;
  message: string;
}

export interface PayloadParseResult {
  punches: DevicePunch[];
  errors: PayloadParseError[];
}

/** Day row produced by folding punches — matches the ingest row shape. */
export interface FoldedDayRow {
  badgeId: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  timeInPm: string | null;
  timeOutPm: string | null;
}

/** Loosely-shaped record as decoded from JSON/CSV/XML before validation. */
export interface RawPunchInput {
  badgeId?: unknown;
  timestamp?: unknown;
  recordType?: unknown;
}

// ---------------------------------------------------------------------------
// Timestamp normalization
// ---------------------------------------------------------------------------

const TIMESTAMP_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Splits a device timestamp into wall-clock {date, time}.
 *
 * Accepts "YYYY-MM-DD HH:MM[:SS]" and ISO-8601 "YYYY-MM-DDTHH:MM[:SS][zone]".
 * The zone suffix, when present, is IGNORED: biometric devices report local
 * wall-clock punches and the attendance ledger stores wall-clock times.
 * Returns null for malformed input.
 */
export function splitTimestamp(
  value: string,
): { date: string; time: string } | null {
  const match = TIMESTAMP_RE.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  if (!y || !mo || !d || !h || !mi) return null;
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59) return null;
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
}

function normalizeRecordType(value: unknown): PunchRecordType | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (
    v === "in" ||
    v === "i" ||
    v === "0" ||
    v === "checkin" ||
    v === "check-in"
  ) {
    return "in";
  }
  if (
    v === "out" ||
    v === "o" ||
    v === "1" ||
    v === "checkout" ||
    v === "check-out"
  ) {
    return "out";
  }
  return null;
}

/** Validates one loose record into a DevicePunch, or returns an error string. */
export function normalizePunch(
  input: RawPunchInput,
): { punch: DevicePunch } | { error: string } {
  const badgeId =
    typeof input.badgeId === "string" || typeof input.badgeId === "number"
      ? String(input.badgeId).trim()
      : "";
  if (!badgeId) return { error: "Missing badgeId" };
  if (badgeId.length > 50) return { error: "badgeId exceeds 50 characters" };

  const rawTimestamp =
    typeof input.timestamp === "string" ? input.timestamp.trim() : "";
  const split = rawTimestamp ? splitTimestamp(rawTimestamp) : null;
  if (!split) {
    return {
      error: `Invalid timestamp "${String(input.timestamp ?? "")}" (expected YYYY-MM-DD HH:MM or ISO-8601)`,
    };
  }

  const recordType = normalizeRecordType(input.recordType);
  if (!recordType) {
    return {
      error: `Invalid recordType "${String(input.recordType ?? "")}" (expected "in" or "out")`,
    };
  }

  return {
    punch: {
      badgeId,
      date: split.date,
      time: split.time,
      recordType,
      rawTimestamp,
    },
  };
}

// ---------------------------------------------------------------------------
// JSON records
// ---------------------------------------------------------------------------

/**
 * Normalizes an already-decoded JSON `records` array. Field-name variants
 * (badge_id, record_type, datetime) are mapped to the canonical keys.
 */
export function parsePunchRecords(
  records: readonly unknown[],
): PayloadParseResult {
  const punches: DevicePunch[] = [];
  const errors: PayloadParseError[] = [];

  records.forEach((record, i) => {
    if (typeof record !== "object" || record === null) {
      errors.push({ index: i + 1, message: "Record is not an object" });
      return;
    }
    const r = record as Record<string, unknown>;
    const result = normalizePunch({
      badgeId: r.badgeId ?? r.badge_id ?? r.badge,
      timestamp: r.timestamp ?? r.datetime ?? r.time,
      recordType: r.recordType ?? r.record_type ?? r.type,
    });
    if ("error" in result) {
      errors.push({ index: i + 1, message: result.error });
    } else {
      punches.push(result.punch);
    }
  });

  return { punches, errors };
}

// ---------------------------------------------------------------------------
// CSV punches
// ---------------------------------------------------------------------------

/** Quoted-value-aware CSV line splitter (same dialect as the import action). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === "," && !inQuote) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

const BADGE_HEADERS = ["badge_id", "badgeid", "badge", "employee_id"];
const TIMESTAMP_HEADERS = ["timestamp", "datetime", "date_time", "time"];
const TYPE_HEADERS = ["record_type", "recordtype", "type", "inout", "status"];

/**
 * Parses a punch-event CSV: one row per punch with badge / timestamp / type
 * columns (header names accept common device-vendor variants).
 */
export function parsePunchCsv(csvText: string): PayloadParseResult {
  const lines = csvText.replace(/\r\n/g, "\n").trim().split("\n");
  const headerLine = lines[0];
  if (!headerLine || lines.length < 2) {
    return {
      punches: [],
      errors: [{ index: 1, message: "CSV has no data rows" }],
    };
  }

  const headers = splitCsvLine(headerLine).map((h) => h.toLowerCase());
  const badgeCol = headers.findIndex((h) => BADGE_HEADERS.includes(h));
  const tsCol = headers.findIndex((h) => TIMESTAMP_HEADERS.includes(h));
  const typeCol = headers.findIndex((h) => TYPE_HEADERS.includes(h));

  if (badgeCol === -1 || tsCol === -1 || typeCol === -1) {
    return {
      punches: [],
      errors: [
        {
          index: 1,
          message:
            "CSV header must include badge_id, timestamp, and record_type columns",
        },
      ],
    };
  }

  const punches: DevicePunch[] = [];
  const errors: PayloadParseError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.trim()) continue;
    const cells = splitCsvLine(line);
    const result = normalizePunch({
      badgeId: cells[badgeCol],
      timestamp: cells[tsCol],
      recordType: cells[typeCol],
    });
    if ("error" in result) {
      errors.push({ index: i + 1, message: result.error });
    } else {
      punches.push(result.punch);
    }
  }

  return { punches, errors };
}

// ---------------------------------------------------------------------------
// XML punches — minimal extractor, DTD/entity processing REJECTED
// ---------------------------------------------------------------------------

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeXmlText(value: string): string {
  return value.replace(
    /&(?:amp|lt|gt|quot|apos);/g,
    (m) => XML_ENTITIES[m] ?? m,
  );
}

function extractTag(fragment: string, names: readonly string[]): string | null {
  for (const name of names) {
    const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i");
    const match = re.exec(fragment);
    if (match?.[1] !== undefined) return decodeXmlText(match[1].trim());
  }
  return null;
}

/**
 * Parses a punch-event XML payload of the shape:
 *
 *   <records>
 *     <record>
 *       <badgeId>1042</badgeId>
 *       <timestamp>2026-07-15 08:01</timestamp>
 *       <recordType>in</recordType>
 *     </record>
 *   </records>
 *
 * Tag-name variants badge_id / record_type are accepted. This is NOT a
 * general XML parser: there is no DTD, entity, namespace, or external
 * reference processing of any kind. Payloads containing `<!DOCTYPE` or
 * `<!ENTITY` are rejected (SEC 3.2.9 — XXE prevention).
 */
export function parsePunchXml(xmlText: string): PayloadParseResult {
  if (/<!DOCTYPE/i.test(xmlText) || /<!ENTITY/i.test(xmlText)) {
    return {
      punches: [],
      errors: [
        {
          index: 1,
          message:
            "XML payloads with DOCTYPE or ENTITY declarations are not accepted",
        },
      ],
    };
  }

  const recordRe = /<record(?:\s[^>]*)?>([\s\S]*?)<\/record>/gi;
  const punches: DevicePunch[] = [];
  const errors: PayloadParseError[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = recordRe.exec(xmlText)) !== null) {
    index += 1;
    const fragment = match[1] ?? "";
    const result = normalizePunch({
      badgeId: extractTag(fragment, ["badgeId", "badge_id", "badge"]),
      timestamp: extractTag(fragment, ["timestamp", "datetime", "time"]),
      recordType: extractTag(fragment, ["recordType", "record_type", "type"]),
    });
    if ("error" in result) {
      errors.push({ index, message: result.error });
    } else {
      punches.push(result.punch);
    }
  }

  if (index === 0) {
    errors.push({
      index: 1,
      message: "No <record> elements found in XML payload",
    });
  }

  return { punches, errors };
}

// ---------------------------------------------------------------------------
// Punch folding — punches → per-(badge, date) day rows
// ---------------------------------------------------------------------------

/**
 * Folds punch events into day rows for the attendance ingest pipeline
 * (TOR 1.5.6 lunch TITO):
 *
 * - 2-punch days (≤1 in or ≤1 out): timeIn = earliest "in",
 *   timeOut = latest "out". Standard whole-day pair.
 * - 4-punch days (≥2 ins and ≥2 outs, chronologically consistent):
 *   timeIn = first in (AM arrival), timeOut = first out (AM departure /
 *   lunch out), timeInPm = last in (PM arrival / lunch return),
 *   timeOutPm = last out (PM departure). Matches the attendance_logs
 *   AM+PM session columns.
 * - Inconsistent 4-punch ordering degrades safely to the 2-punch pair.
 */
export function foldPunchesToDayRows(
  punches: readonly DevicePunch[],
): FoldedDayRow[] {
  const groups = new Map<string, DevicePunch[]>();
  for (const punch of punches) {
    const key = `${punch.badgeId} ${punch.date}`;
    const group = groups.get(key);
    if (group) {
      group.push(punch);
    } else {
      groups.set(key, [punch]);
    }
  }

  const rows: FoldedDayRow[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;

    const ins = group
      .filter((p) => p.recordType === "in")
      .map((p) => p.time)
      .sort();
    const outs = group
      .filter((p) => p.recordType === "out")
      .map((p) => p.time)
      .sort();

    const firstIn = ins[0] ?? null;
    const lastOut = outs.length > 0 ? (outs[outs.length - 1] ?? null) : null;

    let row: FoldedDayRow = {
      badgeId: first.badgeId,
      date: first.date,
      timeIn: firstIn,
      timeOut: lastOut,
      timeInPm: null,
      timeOutPm: null,
    };

    if (ins.length >= 2 && outs.length >= 2) {
      const amOut = outs[0] ?? null;
      const pmIn = ins[ins.length - 1] ?? null;
      // Chronological sanity: in ≤ amOut ≤ pmIn ≤ pmOut
      if (
        firstIn !== null &&
        amOut !== null &&
        pmIn !== null &&
        lastOut !== null &&
        firstIn <= amOut &&
        amOut <= pmIn &&
        pmIn <= lastOut
      ) {
        row = {
          badgeId: first.badgeId,
          date: first.date,
          timeIn: firstIn,
          timeOut: amOut,
          timeInPm: pmIn,
          timeOutPm: lastOut,
        };
      }
    }

    rows.push(row);
  }

  return rows.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.badgeId.localeCompare(b.badgeId),
  );
}
