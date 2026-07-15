"use server";

/**
 * Admin server actions for API client (machine credential) management —
 * TOR 3.3.2 / 3.3.4 (API-001, API-005).
 *
 * Secrets are generated server-side, stored as SHA-256 hashes only, and the
 * plaintext key (`pcso_<clientId>.<secret>`) is returned EXACTLY ONCE from
 * `createApiClient` / `rotateApiClientSecret` for the admin to copy.
 *
 * Authorization mirrors /admin/users: requirePermission("admin", "create")
 * for creation, requirePermission("admin", "edit") for mutations — i.e.
 * super_admin only (see ROUTE_ACCESS "/admin").
 */

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { apiClients } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { sha256Hex, API_KEY_PREFIX } from "@/lib/api/v1/auth";
import { API_SCOPE_VALUES } from "@/lib/api/v1/scopes";

// ─── Schemas (module-private — 'use server' files export async fns only) ────

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  scopes: z
    .array(z.string())
    .min(1, "Select at least one scope")
    .refine((scopes) => scopes.every((s) => API_SCOPE_VALUES.includes(s)), {
      message: "Unknown scope",
    }),
  rateLimitPerMinute: z.coerce.number().int().min(1).max(10_000).default(60),
  /** ISO date (YYYY-MM-DD); must be in the future when provided. */
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const idSchema = z.object({ id: z.string().uuid() });

const setActiveSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateClientId(): string {
  return randomBytes(12).toString("hex"); // 24 chars
}

function generateSecret(): string {
  return randomBytes(32).toString("base64url"); // ~43 chars
}

function pgErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

// ─── createApiClient ─────────────────────────────────────────────────────────

export async function createApiClient(input: unknown): Promise<{
  id: string;
  clientId: string;
  name: string;
  plaintextKey: string;
}> {
  const actor = await requirePermission("admin", "create");
  const parsed = createSchema.parse(input);

  const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null;
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    throw new Error("Expiry date must be in the future");
  }

  const secret = generateSecret();
  const secretHash = sha256Hex(secret);

  // clientId collisions are astronomically unlikely (96 bits) but the unique
  // index makes them harmless — retry a couple of times on 23505.
  let row: { id: string; clientId: string } | undefined;
  for (let attempt = 0; attempt < 3 && !row; attempt += 1) {
    const clientId = generateClientId();
    try {
      const [inserted] = await db
        .insert(apiClients)
        .values({
          name: parsed.name,
          description: parsed.description ?? null,
          clientId,
          secretHash,
          scopes: parsed.scopes,
          rateLimitPerMinute: parsed.rateLimitPerMinute,
          isActive: true,
          expiresAt,
          createdBy: actor.id,
        })
        .returning({ id: apiClients.id, clientId: apiClients.clientId });
      row = inserted;
    } catch (error: unknown) {
      if (pgErrorCode(error) !== "23505") throw error;
    }
  }
  if (!row) throw new Error("Failed to allocate a unique client id");

  void auditLog({
    userId: actor.id,
    action: "create",
    table: "api_clients",
    recordId: row.id,
    module: "API",
    newValues: {
      name: parsed.name,
      clientId: row.clientId,
      scopes: parsed.scopes,
      rateLimitPerMinute: parsed.rateLimitPerMinute,
      expiresAt: parsed.expiresAt ?? null,
    },
  });

  revalidatePath("/admin/api-clients");
  return {
    id: row.id,
    clientId: row.clientId,
    name: parsed.name,
    plaintextKey: `${API_KEY_PREFIX}${row.clientId}.${secret}`,
  };
}

// ─── rotateApiClientSecret ───────────────────────────────────────────────────

export async function rotateApiClientSecret(input: unknown): Promise<{
  id: string;
  clientId: string;
  plaintextKey: string;
}> {
  const actor = await requirePermission("admin", "edit");
  const { id } = idSchema.parse(input);

  const secret = generateSecret();
  const [row] = await db
    .update(apiClients)
    .set({ secretHash: sha256Hex(secret), updatedAt: new Date() })
    .where(eq(apiClients.id, id))
    .returning({ id: apiClients.id, clientId: apiClients.clientId });

  if (!row) throw new Error("API client not found");

  void auditLog({
    userId: actor.id,
    action: "rotate_secret",
    table: "api_clients",
    recordId: row.id,
    module: "API",
    newValues: { clientId: row.clientId },
    reason: "Secret rotated — previous key invalidated immediately",
  });

  revalidatePath("/admin/api-clients");
  return {
    id: row.id,
    clientId: row.clientId,
    plaintextKey: `${API_KEY_PREFIX}${row.clientId}.${secret}`,
  };
}

// ─── setApiClientActive ──────────────────────────────────────────────────────

export async function setApiClientActive(input: unknown): Promise<void> {
  const actor = await requirePermission("admin", "edit");
  const parsed = setActiveSchema.parse(input);

  const [row] = await db
    .update(apiClients)
    .set({ isActive: parsed.isActive, updatedAt: new Date() })
    .where(eq(apiClients.id, parsed.id))
    .returning({ id: apiClients.id, clientId: apiClients.clientId });

  if (!row) throw new Error("API client not found");

  void auditLog({
    userId: actor.id,
    action: "update",
    table: "api_clients",
    recordId: row.id,
    module: "API",
    oldValues: { isActive: !parsed.isActive },
    newValues: { isActive: parsed.isActive, clientId: row.clientId },
  });

  revalidatePath("/admin/api-clients");
}

// ─── deleteApiClient (soft delete) ───────────────────────────────────────────

export async function deleteApiClient(input: unknown): Promise<void> {
  const actor = await requirePermission("admin", "edit");
  const { id } = idSchema.parse(input);

  const [row] = await db
    .update(apiClients)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(eq(apiClients.id, id))
    .returning({ id: apiClients.id, clientId: apiClients.clientId });

  if (!row) throw new Error("API client not found");

  void auditLog({
    userId: actor.id,
    action: "delete",
    table: "api_clients",
    recordId: row.id,
    module: "API",
    oldValues: { clientId: row.clientId },
    reason: "Soft delete — credential can no longer authenticate",
  });

  revalidatePath("/admin/api-clients");
}
