"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { withTx } from "@/lib/db/transaction";
import { lockKey } from "@/lib/concurrency";
import {
  CreateUserSchema,
  UpdateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/validations/admin";

// ---------------------------------------------------------------------------
// createUser
// Uses the service-role admin client to call auth.admin.createUser(), sets
// raw_user_meta_data with role/office_id/employee_id, then inserts a
// system_users row so the record is immediately visible.
//
// Flow:
//   1. supabaseAdmin.auth.admin.createUser()  — creates auth.users row
//   2. db insert into system_users            — explicit row (trigger may also run)
//   3. auditLog                               — immutable COA trail
// ---------------------------------------------------------------------------
export async function createUser(input: unknown): Promise<{ id: string }> {
  const actor = await requirePermission("admin", "create");
  const parsed: CreateUserInput = CreateUserSchema.parse(input);

  // Advisory lock on the email so two admins creating the same user
  // simultaneously serialize; the second will see an existing row and
  // upsert onto it.
  //
  // NOTE: Auth + system_users live in different storage (auth schema vs
  // public); we can't put them in a single drizzle transaction. The upsert
  // on email + post-failure cleanup is the next-best atomicity guarantee.
  const { authUid, newUserId } = await withTx(async (tx) => {
    await lockKey(tx, `admin:user:email:${parsed.email.toLowerCase()}`);

    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: parsed.email,
        email_confirm: true,
        user_metadata: {
          role: parsed.role,
          office_id: parsed.officeId ?? null,
          employee_id: parsed.employeeId ?? null,
        },
      });

    if (createError) {
      throw new Error(`Failed to create auth user: ${createError.message}`);
    }

    const uid = created.user.id;

    const supabase = await createServerClient();
    const { data: row, error: insertError } = await supabase
      .from("system_users")
      .upsert(
        {
          email: parsed.email,
          role: parsed.role,
          office_id: parsed.officeId ?? null,
          employee_id: parsed.employeeId ?? null,
          is_active: true,
          auth_uid: uid,
        },
        { onConflict: "email", ignoreDuplicates: false },
      )
      .select("id")
      .single();

    if (insertError) {
      // Auth user was created; clean up to avoid orphaned auth rows is
      // best-effort. Rolling back the drizzle tx does NOT undo the auth
      // create because it's in a separate schema managed by Supabase Auth.
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => undefined);
      throw new Error(
        `Auth user created but system_users insert failed: ${insertError.message}`,
      );
    }

    return { authUid: uid, newUserId: row.id as string };
  });

  // Fire-and-forget audit — never block user creation on audit insert.
  void auditLog({
    userId: actor.id,
    action: "create",
    table: "system_users",
    recordId: newUserId,
    newValues: {
      email: parsed.email,
      role: parsed.role,
      officeId: parsed.officeId ?? null,
      authUid,
    },
  });

  revalidatePath("/admin/users");
  return { id: newUserId };
}

// ---------------------------------------------------------------------------
// updateUser
// Updates role and/or office scope for an existing system user.
// ---------------------------------------------------------------------------
export async function updateUser(input: unknown): Promise<void> {
  const actor = await requirePermission("admin", "edit");
  const parsed: UpdateUserInput = UpdateUserSchema.parse(input);

  // Lock on user id so two admins editing the same user serialize and the
  // auth metadata update mirrors the final DB state instead of racing.
  const { oldRow, updates } = await withTx(async (tx) => {
    await lockKey(tx, `admin:user:${parsed.id}`);

    const supabase = await createServerClient();

    const { data: row, error: fetchError } = await supabase
      .from("system_users")
      .select("*")
      .eq("id", parsed.id)
      .single();

    if (fetchError || !row) throw new Error("User not found");

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.role !== undefined) patch["role"] = parsed.role;
    if (parsed.officeId !== undefined)
      patch["office_id"] = parsed.officeId ?? null;
    if (parsed.employeeId !== undefined)
      patch["employee_id"] = parsed.employeeId ?? null;

    const { error } = await supabase
      .from("system_users")
      .update(patch)
      .eq("id", parsed.id);
    if (error) throw new Error(`Failed to update user: ${error.message}`);

    // Keep Supabase Auth metadata in sync so `getCurrentUser()` sees fresh
    // role/office. Must use the service-role client.
    if (parsed.role !== undefined || parsed.officeId !== undefined) {
      const authUid = row["auth_uid"] as string | null;
      if (authUid) {
        await supabaseAdmin.auth.admin.updateUserById(authUid, {
          user_metadata: {
            role: parsed.role ?? (row["role"] as string),
            office_id: parsed.officeId ?? (row["office_id"] as string | null),
            employee_id:
              parsed.employeeId ?? (row["employee_id"] as string | null),
          },
        });
      }
    }

    return { oldRow: row, updates: patch };
  });

  void auditLog({
    userId: actor.id,
    action: "update",
    table: "system_users",
    recordId: parsed.id,
    oldValues: oldRow as Record<string, unknown>,
    newValues: { id: parsed.id, ...updates },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${parsed.id}`);
}

// ---------------------------------------------------------------------------
// activateUser
// ---------------------------------------------------------------------------
export async function activateUser(userId: string): Promise<void> {
  const actor = await requirePermission("admin", "edit");

  const alreadyActive = await withTx(async (tx) => {
    await lockKey(tx, `admin:user:${userId}`);

    const supabase = await createServerClient();

    const { data: row, error: fetchError } = await supabase
      .from("system_users")
      .select("id, is_active, auth_uid")
      .eq("id", userId)
      .single();

    if (fetchError || !row) throw new Error("User not found");

    // Idempotent: already active → no-op + no audit spam.
    if (row["is_active"] === true) return true;

    const { error } = await supabase
      .from("system_users")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw new Error(`Failed to activate user: ${error.message}`);

    const authUid = row["auth_uid"] as string | null;
    if (authUid) {
      await supabaseAdmin.auth.admin.updateUserById(authUid, {
        ban_duration: "none",
      });
    }

    return false;
  });

  if (!alreadyActive) {
    void auditLog({
      userId: actor.id,
      action: "update",
      table: "system_users",
      recordId: userId,
      oldValues: { isActive: false },
      newValues: { isActive: true },
    });
  }

  revalidatePath("/admin/users");
}

// ---------------------------------------------------------------------------
// deactivateUser
// ---------------------------------------------------------------------------
export async function deactivateUser(userId: string): Promise<void> {
  const actor = await requirePermission("admin", "edit");

  const alreadyInactive = await withTx(async (tx) => {
    await lockKey(tx, `admin:user:${userId}`);

    const supabase = await createServerClient();

    const { data: row, error: fetchError } = await supabase
      .from("system_users")
      .select("id, is_active, auth_uid")
      .eq("id", userId)
      .single();

    if (fetchError || !row) throw new Error("User not found");

    if (row["is_active"] === false) return true;

    const { error } = await supabase
      .from("system_users")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw new Error(`Failed to deactivate user: ${error.message}`);

    const authUid = row["auth_uid"] as string | null;
    if (authUid) {
      await supabaseAdmin.auth.admin.updateUserById(authUid, {
        ban_duration: "876000h",
      });
    }

    return false;
  });

  if (!alreadyInactive) {
    void auditLog({
      userId: actor.id,
      action: "update",
      table: "system_users",
      recordId: userId,
      oldValues: { isActive: true },
      newValues: { isActive: false },
    });
  }

  revalidatePath("/admin/users");
}

// ---------------------------------------------------------------------------
// deleteUser
// Permanently removes the system_users row AND the Supabase Auth account.
// This is irreversible — the action requires super_admin / admin permission.
// ---------------------------------------------------------------------------
export async function deleteUser(userId: string): Promise<void> {
  const actor = await requirePermission("admin", "edit");

  const { email, authUid } = await withTx(async (tx) => {
    await lockKey(tx, `admin:user:${userId}`);

    const { data: row, error: fetchError } = await supabaseAdmin
      .from("system_users")
      .select("id, email, auth_uid")
      .eq("id", userId)
      .single();

    if (fetchError || !row) throw new Error("User not found");

    const { error: deleteError } = await supabaseAdmin
      .from("system_users")
      .delete()
      .eq("id", userId);

    if (deleteError)
      throw new Error(`Failed to delete user: ${deleteError.message}`);

    return {
      email: row["email"] as string,
      authUid: row["auth_uid"] as string | null,
    };
  });

  if (authUid) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(authUid);
    if (error) {
      // system_users row is already gone; log but don't throw so the caller
      // doesn't see a misleading error.
      console.error(
        `Auth user ${authUid} could not be deleted: ${error.message}`,
      );
    }
  }

  void auditLog({
    userId: actor.id,
    action: "delete",
    table: "system_users",
    recordId: userId,
    oldValues: { email, authUid },
  });

  revalidatePath("/admin/users");
}

// ---------------------------------------------------------------------------
// sendPasswordReset
// Triggers Supabase's built-in password reset email flow.
// ---------------------------------------------------------------------------
export async function sendPasswordReset(userId: string): Promise<void> {
  const actor = await requirePermission("admin", "edit");

  const supabase = await createServerClient();

  const { data: row, error: fetchError } = await supabase
    .from("system_users")
    .select("email")
    .eq("id", userId)
    .single();

  if (fetchError || !row) throw new Error("User not found");

  const email = row["email"] as string;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/reset-password`,
  });

  if (error) throw new Error(`Failed to send password reset: ${error.message}`);

  // Audit is fire-and-forget — email went out already; don't block the
  // response on the audit insert.
  void auditLog({
    userId: actor.id,
    action: "password_reset_sent",
    table: "system_users",
    recordId: userId,
    newValues: { email, triggeredBy: actor.id },
  });
}
