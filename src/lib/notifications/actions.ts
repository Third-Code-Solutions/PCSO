"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { systemUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guards";
import {
  clearReadNotifications as dbClearRead,
  clearAllNotifications as dbClearAll,
  markAllNotificationsRead as dbMarkAllRead,
  type ClearResult,
  type MarkResult,
} from "./index";

/**
 * Resolve the caller's system_users.id from the Supabase session.
 * Enforces authentication via `requireAuth()` — the session's auth UID is the
 * only source of truth. Nobody can pass in another user's id because this
 * function does not accept any input: the id comes exclusively from the
 * server-verified session cookie.
 */
async function currentSystemUserId(): Promise<string | null> {
  try {
    const authUser = await requireAuth();
    const [row] = await db
      .select({ id: systemUsers.id })
      .from(systemUsers)
      .where(eq(systemUsers.authUid, authUser.id))
      .limit(1);
    return row?.id ?? null;
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return null;
  }
}

export type ClearActionResult =
  | { ok: true; deletedCount: number }
  | { ok: false; error: string };

export type MarkActionResult =
  | { ok: true; updatedCount: number }
  | { ok: false; error: string };

/**
 * Mark every unread notification for the currently authenticated user as read.
 * Single atomic UPDATE. Idempotent. Revalidates the root layout so the
 * server-rendered top-nav bell reflects the change immediately.
 */
export async function markAllReadAction(): Promise<MarkActionResult> {
  const userId = await currentSystemUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };
  try {
    const result: MarkResult = await dbMarkAllRead(userId);
    revalidatePath("/", "layout");
    return { ok: true, updatedCount: result.updatedCount };
  } catch {
    return { ok: false, error: "Failed to mark all read" };
  }
}

/**
 * Clear every READ notification for the currently authenticated user.
 * Idempotent: back-to-back calls simply return {deletedCount: 0} on the
 * second call. Safe for concurrent invocation from multiple tabs / devices.
 */
export async function clearReadAction(): Promise<ClearActionResult> {
  const userId = await currentSystemUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };
  try {
    const result: ClearResult = await dbClearRead(userId);
    revalidatePath("/", "layout");
    return { ok: true, deletedCount: result.deletedCount };
  } catch {
    return { ok: false, error: "Failed to clear read notifications" };
  }
}

/**
 * Destructive. Clears ALL notifications (read + unread) for the currently
 * authenticated user.
 */
export async function clearAllAction(): Promise<ClearActionResult> {
  const userId = await currentSystemUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };
  try {
    const result: ClearResult = await dbClearAll(userId);
    revalidatePath("/", "layout");
    return { ok: true, deletedCount: result.deletedCount };
  } catch {
    return { ok: false, error: "Failed to clear notifications" };
  }
}
