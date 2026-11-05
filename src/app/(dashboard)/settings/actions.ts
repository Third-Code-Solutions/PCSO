"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";

// ─── Local types (settings surface owns its own shape) ──────────────────────
// We intentionally do NOT import from `@/lib/db/schema/users` because the
// `notification_prefs` JSONB column is written via the Supabase client against
// a migration (supabase/migrations/add-user-prefs.sql). Keeping the type local
// avoids coupling the self-service surface to the evolving drizzle schema.

export interface NotificationPrefs {
  emailOnLeaveApproved?: boolean;
  emailOnPayrollReleased?: boolean;
  inAppOnly?: boolean;
}

// ─── Validation schemas ──────────────────────────────────────────────────────

const ChangePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must not exceed 128 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const NotificationPrefsSchema = z.object({
  emailOnLeaveApproved: z.boolean(),
  emailOnPayrollReleased: z.boolean(),
  inAppOnly: z.boolean(),
});

// ─── changePassword ──────────────────────────────────────────────────────────

/**
 * Updates the authenticated user's password via Supabase Auth.
 * The current password is validated by Supabase's session — the user must
 * already hold a valid session (i.e. they are logged in). This operation is
 * idempotent by nature — Supabase accepts the same password twice without error.
 */
export async function changePassword(input: unknown): Promise<void> {
  const user = await requireAuth();
  const parsed = ChangePasswordSchema.parse(input);

  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }

  await auditLog({
    userId: user.id,
    action: "update",
    table: "auth.users",
    recordId: user.id,
    newValues: { password_changed: true },
  });
}

// ─── updateNotificationPrefs ─────────────────────────────────────────────────

/**
 * Persists the user's notification preferences into system_users.notification_prefs.
 * Last-write-wins is acceptable for per-user prefs.
 */
export async function updateNotificationPrefs(input: unknown): Promise<void> {
  const user = await requireAuth();
  const parsed = NotificationPrefsSchema.parse(input);

  const supabase = await createServerClient();

  // Find the system_users row that corresponds to this Supabase auth UID.
  const { data: row, error: readError } = await supabase
    .from("system_users")
    .select("id, notification_prefs")
    .eq("auth_uid", user.id)
    .maybeSingle();

  if (readError || !row) {
    throw new Error("User account record not found.");
  }

  const oldPrefs = row.notification_prefs ?? {};

  // system_users UPDATE is super_admin-only under RLS (C-01: self-update let
  // users rewrite their own role). Write ONLY this column via the service
  // role, scoped to the session's own auth UID.
  const { error: updateError } = await supabaseAdmin
    .from("system_users")
    .update({
      notification_prefs: parsed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("auth_uid", user.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await auditLog({
    userId: user.id,
    action: "update",
    table: "system_users",
    recordId: String(row.id),
    oldValues: { notificationPrefs: oldPrefs },
    newValues: { notificationPrefs: parsed },
  });

  revalidatePath("/settings");
}

// ─── signOutAllSessions ──────────────────────────────────────────────────────

/**
 * Signs the user out of all active sessions by calling Supabase's
 * signOut with scope 'global'. The client is then responsible for
 * redirecting to /login.
 */
export async function signOutAllSessions(): Promise<void> {
  const user = await requireAuth();

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });

  if (error) {
    throw new Error(error.message);
  }

  await auditLog({
    userId: user.id,
    action: "signout_all",
    table: "auth.users",
    recordId: user.id,
  });
}

// ─── getNotificationPrefs ────────────────────────────────────────────────────

/**
 * Reads the current user's notification preferences. Returns sensible defaults
 * when the row does not exist or the column is empty / malformed.
 */
export async function getNotificationPrefs(): Promise<
  Required<NotificationPrefs>
> {
  const user = await requireAuth();

  const supabase = await createServerClient();
  const { data: row } = await supabase
    .from("system_users")
    .select("notification_prefs")
    .eq("auth_uid", user.id)
    .maybeSingle();

  const raw = (row?.notification_prefs ?? {}) as Record<string, unknown>;

  return {
    emailOnLeaveApproved:
      typeof raw["emailOnLeaveApproved"] === "boolean"
        ? raw["emailOnLeaveApproved"]
        : true,
    emailOnPayrollReleased:
      typeof raw["emailOnPayrollReleased"] === "boolean"
        ? raw["emailOnPayrollReleased"]
        : true,
    inAppOnly: typeof raw["inAppOnly"] === "boolean" ? raw["inAppOnly"] : false,
  };
}
