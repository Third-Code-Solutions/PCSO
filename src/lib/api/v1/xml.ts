/**
 * XML serialization + response format negotiation — TOR 3.3.9 / 3.3.10.
 *
 * The v1 API defaults to JSON but must also serve XML for legacy government
 * system integrations (e.g. the PCSO Computerized Accounting System). A
 * caller opts into XML with either:
 *
 *   - `?format=xml` query parameter (wins over the Accept header), or
 *   - `Accept: application/xml` (or `text/xml`) request header.
 *
 * `toXml` is a safe, dependency-free serializer:
 *   - all text content and attribute-free element values are entity-escaped,
 *   - element names are sanitized to valid XML NCNames (invalid chars → "_",
 *     leading digit prefixed) so hostile object keys cannot break the doc,
 *   - arrays serialize as REPEATED elements (one element per item, named
 *     after the property key — or `<item>` at the root / inside arrays),
 *   - null/undefined → empty self-closed element,
 *   - Date → ISO-8601 string.
 *
 * Pure module — unit-tested without a server runtime.
 */

import { NextResponse } from "next/server";

export const XML_CONTENT_TYPE = "application/xml; charset=utf-8";
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

// ─── Escaping / name sanitization ────────────────────────────────────────────

/** Escape the five XML special entities in text content. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Coerce an arbitrary string into a valid XML element name. Letters,
 * digits, "-", "_", "." survive; everything else becomes "_". Names may not
 * start with a digit, "-", or "." (prefixed with "_"). Empty → "item".
 */
export function sanitizeXmlName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_.-]/g, "_");
  if (cleaned.length === 0) return "item";
  if (/^[0-9.-]/.test(cleaned)) return `_${cleaned}`;
  // "xml" prefix (any case) is reserved by the spec.
  if (/^xml/i.test(cleaned)) return `_${cleaned}`;
  return cleaned;
}

// ─── Serializer ──────────────────────────────────────────────────────────────

function serializeValue(name: string, value: unknown): string {
  const tag = sanitizeXmlName(name);

  if (value === null || value === undefined) {
    return `<${tag}/>`;
  }
  if (value instanceof Date) {
    return `<${tag}>${escapeXml(value.toISOString())}</${tag}>`;
  }
  if (Array.isArray(value)) {
    // Repeated elements: <name>…</name><name>…</name>. Nested arrays fall
    // back to <item> for the inner level.
    return value
      .map((entry) =>
        Array.isArray(entry)
          ? `<${tag}>${entry.map((inner) => serializeValue("item", inner)).join("")}</${tag}>`
          : serializeValue(name, entry),
      )
      .join("");
  }
  if (typeof value === "object") {
    const children = Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => serializeValue(key, child))
      .join("");
    return children.length > 0 ? `<${tag}>${children}</${tag}>` : `<${tag}/>`;
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    return `<${tag}/>`;
  }
  return `<${tag}>${escapeXml(String(value))}</${tag}>`;
}

/**
 * Serialize `data` as an XML document rooted at `rootName`.
 *
 * A root-level array is wrapped: `<root><item>…</item><item>…</item></root>`.
 */
export function toXml(rootName: string, data: unknown): string {
  const root = sanitizeXmlName(rootName);
  if (Array.isArray(data)) {
    const items = data.map((entry) => serializeValue("item", entry)).join("");
    return `${XML_DECLARATION}<${root}>${items}</${root}>`;
  }
  const body = serializeValue(root, data);
  return `${XML_DECLARATION}${body}`;
}

// ─── Format negotiation ──────────────────────────────────────────────────────

export type ApiFormat = "json" | "xml";

/**
 * Decide the response format for a request. `?format=xml|json` wins over
 * the Accept header; `Accept: application/xml` / `text/xml` selects XML;
 * everything else (including the any-type wildcard) defaults to JSON.
 */
export function negotiateFormat(request: Request): ApiFormat {
  let queryFormat: string | null = null;
  try {
    queryFormat = new URL(request.url).searchParams.get("format");
  } catch {
    queryFormat = null;
  }
  if (queryFormat) {
    const normalized = queryFormat.trim().toLowerCase();
    if (normalized === "xml") return "xml";
    if (normalized === "json") return "json";
  }
  const accept = request.headers.get("accept") ?? "";
  if (/\b(application|text)\/xml\b/i.test(accept)) return "xml";
  return "json";
}

// ─── Response builder ────────────────────────────────────────────────────────

export interface ApiResponseInit {
  status?: number;
  headers?: Record<string, string>;
}

/**
 * Build the v1 success response in the negotiated format. Always sets
 * `Cache-Control: no-store` (house convention for every v1 response).
 */
export function apiResponse(
  request: Request,
  rootName: string,
  data: unknown,
  init: ApiResponseInit = {},
): NextResponse {
  const status = init.status ?? 200;
  const baseHeaders: Record<string, string> = {
    "Cache-Control": "no-store",
    ...(init.headers ?? {}),
  };

  if (negotiateFormat(request) === "xml") {
    return new NextResponse(toXml(rootName, data), {
      status,
      headers: { ...baseHeaders, "Content-Type": XML_CONTENT_TYPE },
    });
  }
  return NextResponse.json(data, { status, headers: baseHeaders });
}
