/**
 * Unit tests — v1 XML serializer + format negotiation (TOR 3.3.9).
 * Pure functions only; no server runtime required.
 */
import { describe, it, expect } from "vitest";

import { escapeXml, sanitizeXmlName, toXml, negotiateFormat } from "./xml";

const DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

describe("escapeXml", () => {
  it("escapes all five XML entities", () => {
    // Arrange
    const raw = `Tom & Jerry <"quoted"> 'apos'`;

    // Act
    const escaped = escapeXml(raw);

    // Assert
    expect(escaped).toBe(
      "Tom &amp; Jerry &lt;&quot;quoted&quot;&gt; &apos;apos&apos;",
    );
  });

  it("leaves safe text untouched", () => {
    expect(escapeXml("Dela Cruz, Juan")).toBe("Dela Cruz, Juan");
  });
});

describe("sanitizeXmlName", () => {
  it("replaces invalid characters with underscores", () => {
    expect(sanitizeXmlName("first name!")).toBe("first_name_");
  });

  it("prefixes names starting with a digit", () => {
    expect(sanitizeXmlName("13th_month")).toBe("_13th_month");
  });

  it("prefixes reserved xml-prefixed names", () => {
    expect(sanitizeXmlName("xmlData")).toBe("_xmlData");
  });

  it("falls back to item for empty names", () => {
    expect(sanitizeXmlName("")).toBe("item");
  });
});

describe("toXml", () => {
  it("serializes a flat object with declaration", () => {
    const xml = toXml("employee", { first_name: "Juan", step: 3 });
    expect(xml).toBe(
      `${DECLARATION}<employee><first_name>Juan</first_name><step>3</step></employee>`,
    );
  });

  it("escapes entities in values", () => {
    const xml = toXml("doc", { note: "a < b & c" });
    expect(xml).toContain("<note>a &lt; b &amp; c</note>");
  });

  it("serializes arrays as repeated elements", () => {
    const xml = toXml("client", { scopes: ["employees:read", "leave:read"] });
    expect(xml).toContain(
      "<scopes>employees:read</scopes><scopes>leave:read</scopes>",
    );
  });

  it("wraps a root-level array in <item> elements", () => {
    const xml = toXml("employees", [{ id: 1 }, { id: 2 }]);
    expect(xml).toBe(
      `${DECLARATION}<employees><item><id>1</id></item><item><id>2</id></item></employees>`,
    );
  });

  it("renders null and undefined as empty self-closed elements", () => {
    const xml = toXml("employee", { middle_name: null, suffix: undefined });
    expect(xml).toContain("<middle_name/>");
    expect(xml).toContain("<suffix/>");
  });

  it("serializes nested objects recursively", () => {
    const xml = toXml("response", {
      meta: { total: 2, page: 1 },
    });
    expect(xml).toContain("<meta><total>2</total><page>1</page></meta>");
  });

  it("serializes Date values as ISO strings", () => {
    const date = new Date("2026-07-15T00:00:00.000Z");
    const xml = toXml("doc", { issued_at: date });
    expect(xml).toContain("<issued_at>2026-07-15T00:00:00.000Z</issued_at>");
  });

  it("serializes booleans as text", () => {
    const xml = toXml("doc", { is_pwd: false });
    expect(xml).toContain("<is_pwd>false</is_pwd>");
  });

  it("sanitizes hostile keys so the document stays well-formed", () => {
    const xml = toXml("doc", { "bad key/><evil": "x" });
    expect(xml).toContain("<bad_key___evil>x</bad_key___evil>");
    expect(xml).not.toContain("<evil");
  });

  it("renders non-finite numbers as empty elements", () => {
    const xml = toXml("doc", { ratio: Number.POSITIVE_INFINITY });
    expect(xml).toContain("<ratio/>");
  });
});

describe("negotiateFormat", () => {
  it("defaults to json", () => {
    const request = new Request("https://hris.pcso.gov.ph/api/v1/employees");
    expect(negotiateFormat(request)).toBe("json");
  });

  it("selects xml via ?format=xml", () => {
    const request = new Request(
      "https://hris.pcso.gov.ph/api/v1/employees?format=xml",
    );
    expect(negotiateFormat(request)).toBe("xml");
  });

  it("selects xml via Accept: application/xml", () => {
    const request = new Request("https://hris.pcso.gov.ph/api/v1/employees", {
      headers: { accept: "application/xml" },
    });
    expect(negotiateFormat(request)).toBe("xml");
  });

  it("selects xml via Accept: text/xml", () => {
    const request = new Request("https://hris.pcso.gov.ph/api/v1/employees", {
      headers: { accept: "text/xml" },
    });
    expect(negotiateFormat(request)).toBe("xml");
  });

  it("query parameter beats the Accept header", () => {
    const request = new Request(
      "https://hris.pcso.gov.ph/api/v1/employees?format=json",
      { headers: { accept: "application/xml" } },
    );
    expect(negotiateFormat(request)).toBe("json");
  });

  it("ignores unknown format values and falls back to Accept/json", () => {
    const request = new Request(
      "https://hris.pcso.gov.ph/api/v1/employees?format=yaml",
    );
    expect(negotiateFormat(request)).toBe("json");
  });

  it("treats Accept: */* as json", () => {
    const request = new Request("https://hris.pcso.gov.ph/api/v1/employees", {
      headers: { accept: "*/*" },
    });
    expect(negotiateFormat(request)).toBe("json");
  });
});
