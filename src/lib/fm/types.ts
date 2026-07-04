import { z } from "zod";
import type { AnyPgTable } from "drizzle-orm/pg-core";

/** Input widget + validation shape for one editable FM column. */
export type FmFieldType =
  | "text"
  | "textarea"
  | "int"
  | "decimal"
  | "boolean"
  | "date"
  | "select"
  | "multiselect";

export interface FmField {
  /** camelCase property name on the Drizzle table. */
  key: string;
  label: string;
  type: FmFieldType;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  /** Allowed values for select/multiselect. */
  options?: readonly string[];
  /** Extra format constraint for text fields. */
  format?: "uuid";
  help?: string;
}

export type FmGroup =
  | "personal"
  | "organization"
  | "documents"
  | "training"
  | "compensation"
  | "attendance"
  | "separation";

export interface FmTableDef {
  /** URL-safe registry key, e.g. "regions". */
  key: string;
  label: string;
  /** TOR §1.1 item this lookup satisfies, e.g. "1.1.31". */
  torRef: string;
  group: FmGroup;
  table: AnyPgTable;
  fields: FmField[];
  /** Field keys searched with ILIKE. */
  searchFields: string[];
  /** Primary display column (first table column shown). */
  displayField: string;
  /** Column used for ORDER BY (falls back to displayField). */
  orderField?: string;
  /** Whether the table has an is_active column (else soft-delete only). */
  hasIsActive: boolean;
}

/** JSON-safe projection of FmTableDef for client components (no Drizzle table). */
export type FmTableMeta = Omit<FmTableDef, "table">;

export function toMeta(def: FmTableDef): FmTableMeta {
  const { table: _table, ...meta } = def;
  return meta;
}

/** Module-owned lookups surfaced on the FM index for TOR 1.1.56 completeness. */
export interface FmExternalLookup {
  label: string;
  torRef: string;
  href: string;
  managedBy: string;
}

// ─── Zod builder ─────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Empty strings from form inputs mean "not provided". */
function blankToUndefined(v: unknown): unknown {
  return typeof v === "string" && v.trim() === "" ? undefined : v;
}

function fieldSchema(field: FmField): z.ZodTypeAny {
  let schema: z.ZodTypeAny;
  switch (field.type) {
    case "text":
    case "textarea": {
      let s = z
        .string()
        .trim()
        .max(field.maxLength ?? 500);
      if (field.required) s = s.min(1, `${field.label} is required`);
      schema =
        field.format === "uuid"
          ? s.regex(UUID_RE, `${field.label} must be a valid UUID`)
          : s;
      break;
    }
    case "int": {
      let n = z.coerce.number().int();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      schema = n;
      break;
    }
    case "decimal": {
      // Drizzle numeric columns expect string values.
      let n = z.coerce.number();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      schema = n.transform((v) => String(v));
      break;
    }
    case "boolean":
      schema = z.boolean();
      break;
    case "date":
      schema = z.string().regex(DATE_RE, `${field.label} must be YYYY-MM-DD`);
      break;
    case "select":
      schema = z.enum(field.options as [string, ...string[]]);
      break;
    case "multiselect":
      schema = z.array(z.enum(field.options as [string, ...string[]]));
      break;
  }
  if (!field.required) {
    schema = schema.optional().nullable();
  }
  return z.preprocess(blankToUndefined, schema);
}

/**
 * Builds the validation schema for an FM table from its field metadata.
 * `partial` relaxes every field for PATCH-style updates.
 */
export function buildFmZod(
  def: Pick<FmTableDef, "fields">,
  opts: { partial?: boolean } = {},
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of def.fields) {
    shape[field.key] = fieldSchema(field);
  }
  const obj = z.object(shape).strict();
  return (opts.partial ? obj.partial() : obj) as z.ZodObject<
    Record<string, z.ZodTypeAny>
  >;
}
