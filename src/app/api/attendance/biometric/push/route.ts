import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditLogs, biometricDevices } from "@/lib/db/schema";
import {
  parsePunchCsv,
  parsePunchRecords,
  parsePunchXml,
  type PayloadParseResult,
} from "@/lib/utils/attendance/biometric-payload";
import { ingestDevicePunches } from "@/lib/actions/attendance/biometric-ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/attendance/biometric/push — TOR 1.5.2 (TAM-004).
 *
 * Real-time push endpoint for BFR devices. Devices authenticate with
 * `Authorization: Bearer <deviceApiKey>`; the SHA-256 of the presented key
 * must match an active push-mode row in biometric_devices (constant-time
 * comparison — no key material is ever stored).
 *
 * Accepted payloads (selected by Content-Type):
 *   - application/json  {"records":[{"badgeId","timestamp","recordType"}]}
 *   - text/csv          badge_id,timestamp,record_type rows
 *   - application/xml   <records><record><badgeId>…</record></records>
 *     (minimal extractor — payloads containing <!DOCTYPE or <!ENTITY are
 *      rejected outright per SEC 3.2.9; no DTD/entity processing exists)
 *
 * Limits: 20,000 records and 10MB per request. Errors follow the RFC 7807
 * problem-details shape.
 */

const MAX_RECORDS = 20_000;
const MAX_BODY_BYTES = 10 * 1024 * 1024;

const PushJsonSchema = z.object({
  records: z
    .array(z.unknown())
    .min(1, "records must not be empty")
    .max(MAX_RECORDS, `records is capped at ${MAX_RECORDS} per request`),
});

function problem(
  status: number,
  title: string,
  detail: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { type: "about:blank", title, status, detail, ...extra },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

/** Constant-time hash comparison of two sha256 hex digests. */
function hashesMatch(presentedHex: string, storedHex: string): boolean {
  if (storedHex.length !== 64 || presentedHex.length !== 64) return false;
  try {
    return timingSafeEqual(
      Buffer.from(presentedHex, "hex"),
      Buffer.from(storedHex, "hex"),
    );
  } catch {
    return false;
  }
}

interface AuthenticatedDevice {
  id: string;
  name: string;
  payloadFormat: "csv" | "json" | "xml";
}

/**
 * Resolves the presenting device from the bearer key. Every active
 * push-device hash is compared (constant-time per comparison) so response
 * timing does not reveal which hashes exist.
 */
async function authenticateDevice(
  request: NextRequest,
): Promise<AuthenticatedDevice | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const key = match?.[1]?.trim();
  if (!key) return null;

  const presentedHash = createHash("sha256").update(key).digest("hex");

  const devices = await db
    .select({
      id: biometricDevices.id,
      name: biometricDevices.name,
      payloadFormat: biometricDevices.payloadFormat,
      apiKeyHash: biometricDevices.apiKeyHash,
    })
    .from(biometricDevices)
    .where(
      and(
        eq(biometricDevices.mode, "push"),
        eq(biometricDevices.isActive, true),
        isNull(biometricDevices.deletedAt),
      ),
    );

  let found: AuthenticatedDevice | null = null;
  for (const device of devices) {
    if (device.apiKeyHash && hashesMatch(presentedHash, device.apiKeyHash)) {
      // No early exit: scan the full list so timing stays uniform.
      found ??= {
        id: device.id,
        name: device.name,
        payloadFormat: device.payloadFormat,
      };
    }
  }
  return found;
}

function parseBody(
  contentType: string,
  body: string,
  fallbackFormat: "csv" | "json" | "xml",
): PayloadParseResult | { problem: NextResponse } {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  const format: "csv" | "json" | "xml" =
    type === "application/json"
      ? "json"
      : type === "text/csv"
        ? "csv"
        : type === "application/xml" || type === "text/xml"
          ? "xml"
          : fallbackFormat;

  if (format === "json") {
    let decoded: unknown;
    try {
      decoded = JSON.parse(body);
    } catch {
      return {
        problem: problem(
          400,
          "Malformed JSON",
          "Request body is not valid JSON.",
        ),
      };
    }
    const parsed = PushJsonSchema.safeParse(decoded);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        problem: problem(
          400,
          "Invalid payload",
          issue
            ? `${issue.path.join(".")}: ${issue.message}`
            : "Invalid payload shape.",
        ),
      };
    }
    return parsePunchRecords(parsed.data.records);
  }

  return format === "csv" ? parsePunchCsv(body) : parsePunchXml(body);
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const device = await authenticateDevice(request);
    if (!device) {
      return problem(
        401,
        "Unauthorized",
        "Missing or unrecognized device API key.",
      );
    }

    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) {
      return problem(
        413,
        "Payload too large",
        "Request body exceeds the 10MB limit.",
      );
    }
    if (!body.trim()) {
      return problem(400, "Empty payload", "Request body is empty.");
    }

    const parsed = parseBody(
      request.headers.get("content-type") ?? "",
      body,
      device.payloadFormat,
    );
    if ("problem" in parsed) return parsed.problem;

    if (parsed.punches.length > MAX_RECORDS) {
      return problem(
        413,
        "Too many records",
        `Requests are capped at ${MAX_RECORDS.toLocaleString()} records. Received ${parsed.punches.length.toLocaleString()}.`,
      );
    }
    if (parsed.punches.length === 0) {
      return problem(
        400,
        "No valid records",
        "No parseable punch records were found in the payload.",
        { errors: parsed.errors.slice(0, 50) },
      );
    }

    const summary = await ingestDevicePunches({
      punches: parsed.punches,
      parseErrorCount: parsed.errors.length,
      origin: "push",
      deviceId: device.id,
      deviceName: device.name,
      // Push requests carry no authenticated employee; raw-record archival
      // requires an attributable employee (imported_by_id NOT NULL), so the
      // push path is tracked via transaction_logs instead.
      attributionEmployeeId: null,
      actorUserId: null,
    });

    await db.insert(auditLogs).values({
      userId: null,
      action: "attendance.biometric_push",
      tableName: "attendance_logs",
      newValues: {
        deviceId: device.id,
        deviceName: device.name,
        receivedPunches: summary.receivedPunches,
        dayRows: summary.dayRows,
        imported: summary.imported,
        skipped: summary.skipped,
        unmatchedBadges: summary.unmatchedBadgeCount,
        parseErrors: parsed.errors.length,
        durationMs: Date.now() - startedAt,
      },
    });

    return NextResponse.json({
      success: summary.skipped === 0,
      device: device.name,
      received: summary.receivedPunches,
      dayRows: summary.dayRows,
      imported: summary.imported,
      skipped: summary.skipped,
      unmatchedBadges: summary.unmatchedBadgeCount,
      errors: [...parsed.errors.slice(0, 50), ...summary.errors.slice(0, 50)],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/attendance/biometric/push] Ingest failed:", error);
    return problem(500, "Internal error", message);
  }
}
