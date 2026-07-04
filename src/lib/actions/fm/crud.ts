"use server";

/**
 * Generic File Maintenance CRUD — TOR 1.1.57 (add / edit / deactivate /
 * search / view for every §1.1 lookup) driven by the FM registry.
 *
 * Deactivation is soft (FM-031): tables with is_active toggle it; tables
 * without fall back to deleted_at. Nothing is ever hard-deleted.
 */

import { revalidatePath } from "next/cache";
import { and, asc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { getTableColumns, getTableName } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { getFmDef } from "@/lib/fm/registry";
import { buildFmZod } from "@/lib/fm/types";
import type { FmTableDef } from "@/lib/fm/types";

const FM_PATH = "/admin/file-maintenance";
const PAGE_SIZE = 50;

export interface FmRecord {
  id: string;
  isActive: boolean;
  [key: string]: unknown;
}

export interface FmListResult {
  rows: FmRecord[];
  total: number;
  page: number;
  pageSize: number;
}

function mustGetDef(tableKey: string): FmTableDef {
  const def = getFmDef(tableKey);
  if (!def) throw new Error(`Unknown file-maintenance table: ${tableKey}`);
  return def;
}

function columnsOf(def: FmTableDef): Record<string, AnyPgColumn> {
  return getTableColumns(def.table) as Record<string, AnyPgColumn>;
}

/** Registry-validated column access (registry.test.ts guarantees presence). */
function col(cols: Record<string, AnyPgColumn>, key: string): AnyPgColumn {
  const c = cols[key];
  if (!c) throw new Error(`Missing column: ${key}`);
  return c;
}

/** Normalizes a raw row to FmRecord (isActive true when column absent). */
function toRecord(def: FmTableDef, row: Record<string, unknown>): FmRecord {
  return {
    ...row,
    id: String(row.id),
    isActive: def.hasIsActive ? Boolean(row.isActive) : row.deletedAt == null,
  };
}

// ─── List / search ───────────────────────────────────────────────────────────

export async function listFmRecords(
  tableKey: string,
  opts: { search?: string; includeInactive?: boolean; page?: number } = {},
): Promise<FmListResult> {
  await requirePermission("file_maintenance", "view");
  const def = mustGetDef(tableKey);
  const cols = columnsOf(def);
  const page = Math.max(1, opts.page ?? 1);

  const conditions: SQL[] = [];

  if (!opts.includeInactive) {
    conditions.push(isNull(col(cols, "deletedAt")));
    if (def.hasIsActive) conditions.push(eq(col(cols, "isActive"), true));
  }

  const search = opts.search?.trim();
  if (search && def.searchFields.length > 0) {
    const pattern = `%${search.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const clauses = def.searchFields.flatMap((f) => {
      const c = cols[f];
      return c ? [ilike(c, pattern)] : [];
    });
    if (clauses.length > 0) {
      const combined = clauses.length === 1 ? clauses[0] : or(...clauses);
      if (combined) conditions.push(combined);
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const orderCol = col(cols, def.orderField ?? def.displayField);

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(def.table)
      .where(where)
      .orderBy(asc(orderCol))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(def.table)
      .where(where),
  ]);

  return {
    rows: (rows as Record<string, unknown>[]).map((r) => toRecord(def, r)),
    total: countRows[0]?.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createFmRecord(
  tableKey: string,
  input: unknown,
): Promise<{ id: string }> {
  const actor = await requirePermission("file_maintenance", "create");
  const def = mustGetDef(tableKey);
  const parsed = buildFmZod(def).parse(input);

  const [inserted] = await db
    .insert(def.table)
    .values(parsed as never)
    .returning();

  const id = String((inserted as Record<string, unknown>).id);

  void auditLog({
    userId: actor.id,
    action: "create",
    table: getTableName(def.table),
    recordId: id,
    newValues: parsed,
    module: "FM",
    subModule: def.key,
  });

  revalidatePath(FM_PATH);
  return { id };
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateFmRecord(
  tableKey: string,
  id: string,
  input: unknown,
): Promise<void> {
  const actor = await requirePermission("file_maintenance", "edit");
  const def = mustGetDef(tableKey);
  const cols = columnsOf(def);
  const parsed = buildFmZod(def, { partial: true }).parse(input);

  const [before] = await db
    .select()
    .from(def.table)
    .where(eq(col(cols, "id"), id))
    .limit(1);
  if (!before) throw new Error("Record not found");

  await db
    .update(def.table)
    .set({
      ...(parsed as Record<string, unknown>),
      updatedAt: new Date(),
    } as never)
    .where(eq(col(cols, "id"), id));

  void auditLog({
    userId: actor.id,
    action: "update",
    table: getTableName(def.table),
    recordId: id,
    oldValues: before as Record<string, unknown>,
    newValues: parsed,
    module: "FM",
    subModule: def.key,
  });

  revalidatePath(FM_PATH);
}

// ─── Activate / deactivate (FM-031: never hard-delete) ─────────────────────

export async function setFmRecordActive(
  tableKey: string,
  id: string,
  active: boolean,
): Promise<void> {
  const actor = await requirePermission("file_maintenance", "delete");
  const def = mustGetDef(tableKey);
  const cols = columnsOf(def);

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (def.hasIsActive) {
    patch.isActive = active;
  } else {
    patch.deletedAt = active ? null : new Date();
  }

  await db
    .update(def.table)
    .set(patch as never)
    .where(eq(col(cols, "id"), id));

  void auditLog({
    userId: actor.id,
    action: active ? "activate" : "deactivate",
    table: getTableName(def.table),
    recordId: id,
    newValues: { active },
    module: "FM",
    subModule: def.key,
  });

  revalidatePath(FM_PATH);
}
