import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { FM_REGISTRY, FM_EXTERNAL_LOOKUPS, getFmDef } from "./registry";
import { buildFmZod } from "./types";
import type { FmField } from "./types";

function sampleValue(field: FmField): unknown {
  switch (field.type) {
    case "text":
      return field.format === "uuid"
        ? "0b7e5f3a-4d2c-4f1e-9a8b-1c2d3e4f5a6b"
        : "ABC".slice(0, field.maxLength ?? 3);
    case "textarea":
      return "Sample description";
    case "int":
      return field.min ?? 1;
    case "decimal":
      return field.min ?? 1;
    case "boolean":
      return true;
    case "date":
      return "2026-01-01";
    case "select":
      return field.options?.[0];
    case "multiselect":
      return field.options ? [field.options[0]] : [];
  }
}

describe("FM registry", () => {
  it("has unique table keys", () => {
    const keys = FM_REGISTRY.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("covers 35 maintainable lookups plus 12 module-owned lookups", () => {
    expect(FM_REGISTRY.length).toBe(35);
    expect(FM_EXTERNAL_LOOKUPS.length).toBe(12);
  });

  it("every entry has a TOR reference and at least one field", () => {
    for (const def of FM_REGISTRY) {
      expect(def.torRef, def.key).toMatch(/^1\.1\.\d+$/);
      expect(def.fields.length, def.key).toBeGreaterThan(0);
    }
  });

  it("every field/searchField/displayField maps to a real table column", () => {
    for (const def of FM_REGISTRY) {
      const cols = getTableColumns(def.table) as Record<string, unknown>;
      for (const field of def.fields) {
        expect(cols[field.key], `${def.key}.${field.key}`).toBeDefined();
      }
      for (const sf of def.searchFields) {
        expect(cols[sf], `${def.key} searchField ${sf}`).toBeDefined();
      }
      expect(cols[def.displayField], `${def.key} displayField`).toBeDefined();
      if (def.orderField) {
        expect(cols[def.orderField], `${def.key} orderField`).toBeDefined();
      }
    }
  });

  it("hasIsActive matches the presence of an isActive column", () => {
    for (const def of FM_REGISTRY) {
      const cols = getTableColumns(def.table) as Record<string, unknown>;
      expect(Boolean(cols.isActive), def.key).toBe(def.hasIsActive);
    }
  });

  it("select/multiselect fields declare options", () => {
    for (const def of FM_REGISTRY) {
      for (const field of def.fields) {
        if (field.type === "select" || field.type === "multiselect") {
          expect(
            field.options?.length,
            `${def.key}.${field.key}`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("zod builder accepts a synthesized valid record for every table", () => {
    for (const def of FM_REGISTRY) {
      const input: Record<string, unknown> = {};
      for (const field of def.fields) {
        input[field.key] = sampleValue(field);
      }
      const result = buildFmZod(def).safeParse(input);
      expect(
        result.success,
        `${def.key}: ${result.success ? "" : JSON.stringify(result.error.issues)}`,
      ).toBe(true);
    }
  });

  it("zod builder rejects a record missing a required field", () => {
    for (const def of FM_REGISTRY) {
      const required = def.fields.find((f) => f.required);
      if (!required) continue;
      const input: Record<string, unknown> = {};
      for (const field of def.fields) {
        if (field.key !== required.key) input[field.key] = sampleValue(field);
      }
      expect(buildFmZod(def).safeParse(input).success, def.key).toBe(false);
    }
  });

  it("zod builder converts decimals to strings for Drizzle numeric columns", () => {
    const def = getFmDef("provident-fund-rates");
    expect(def).toBeDefined();
    const parsed = buildFmZod(def!).parse({
      name: "GSIS Provident Fund",
      employeeSharePercent: 2,
      employerSharePercent: 2.5,
      salaryCap: "",
      effectiveDate: "2026-01-01",
      remarks: "",
    });
    expect(parsed.employeeSharePercent).toBe("2");
    expect(parsed.employerSharePercent).toBe("2.5");
  });

  it("partial schema accepts sparse updates and strict-rejects unknown keys", () => {
    const def = getFmDef("regions");
    expect(def).toBeDefined();
    const partial = buildFmZod(def!, { partial: true });
    expect(partial.safeParse({ name: "Updated Region" }).success).toBe(true);
    expect(partial.safeParse({ nope: "x" }).success).toBe(false);
  });

  it("getFmDef returns undefined for unknown keys", () => {
    expect(getFmDef("not-a-table")).toBeUndefined();
  });
});
