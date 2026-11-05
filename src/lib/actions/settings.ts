"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  orgProfile,
  DEFAULT_ORG_PROFILE_ID,
  systemUsers,
  systemRoleEnum,
} from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";

/** Blank form fields arrive as "" — store them as NULL. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const OrgProfileSchema = z.object({
  agencyName: z.string().trim().min(1, "Agency name is required").max(200),
  agencyShortName: z.string().trim().min(1, "Short name is required").max(40),
  agencyAddress: z.string().trim().min(1, "Address is required").max(1000),
  logoUrl: z.string().trim().min(1, "Logo URL is required").max(500),
  birTin: optionalText(30),
  birAgencyName: optionalText(200),
  philhealthEmployerNo: optionalText(30),
  pagibigEmployerNo: optionalText(30),
  gsisAgencyName: optionalText(200),
  gsisEmployerNo: optionalText(30),
  contactEmail: z
    .union([
      z.literal(""),
      z.string().trim().email("Invalid contact email").max(200),
    ])
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  contactPhone: optionalText(40),
  websiteUrl: optionalText(200),
});

const UpdateUserRoleSchema = z.object({
  userId: z.string().uuid("Invalid user id"),
  role: z.enum(systemRoleEnum.enumValues, {
    errorMap: () => ({ message: "Invalid role" }),
  }),
});

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/**
 * Update organization profile (P0-001)
 * Super admin only
 */
export async function updateOrgProfile(formData: FormData) {
  // requirePermission also enforces the aal2 (MFA) session for super_admin.
  const user = await requirePermission("admin", "edit");

  const field = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : null;
  };
  const parsed = OrgProfileSchema.safeParse({
    agencyName: field("agencyName"),
    agencyShortName: field("agencyShortName"),
    agencyAddress: field("agencyAddress"),
    logoUrl: field("logoUrl"),
    birTin: field("birTin"),
    birAgencyName: field("birAgencyName"),
    philhealthEmployerNo: field("philhealthEmployerNo"),
    pagibigEmployerNo: field("pagibigEmployerNo"),
    gsisAgencyName: field("gsisAgencyName"),
    gsisEmployerNo: field("gsisEmployerNo"),
    contactEmail: field("contactEmail"),
    contactPhone: field("contactPhone"),
    websiteUrl: field("websiteUrl"),
  });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  const values = parsed.data;

  const [before] = await db
    .select()
    .from(orgProfile)
    .where(eq(orgProfile.id, DEFAULT_ORG_PROFILE_ID))
    .limit(1);

  await db
    .update(orgProfile)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(orgProfile.id, DEFAULT_ORG_PROFILE_ID));

  // H-34: agency identity feeds every PDF and remittance file — audit it.
  const changedKeys = (
    Object.keys(values) as Array<keyof typeof values>
  ).filter((k) => (before?.[k] ?? null) !== values[k]);
  await auditLog({
    userId: user.id,
    action: "org_profile.update",
    table: "org_profile",
    oldValues: Object.fromEntries(
      changedKeys.map((k) => [k, before?.[k] ?? null]),
    ),
    newValues: Object.fromEntries(changedKeys.map((k) => [k, values[k]])),
    module: "ADMIN",
    subModule: "org_profile",
    severity: "warn",
  });

  revalidatePath("/settings/org-profile");
  revalidatePath("/dashboard");

  return { success: true };
}

/**
 * Update user role — the role alone determines the dashboard (PRD 3.4).
 * Super admin only
 */
export async function updateUserRole(userId: string, role: string) {
  // requirePermission also enforces the aal2 (MFA) session for super_admin.
  const user = await requirePermission("admin", "edit");

  // H-34: server actions are public endpoints — validate the role at runtime.
  const parsed = UpdateUserRoleSchema.safeParse({ userId, role });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  const input = parsed.data;

  const [before] = await db
    .select({ role: systemUsers.role })
    .from(systemUsers)
    .where(eq(systemUsers.id, input.userId))
    .limit(1);
  if (!before) throw new Error("User not found");

  const [updated] = await db
    .update(systemUsers)
    .set({
      role: input.role,
      updatedAt: new Date(),
    })
    .where(eq(systemUsers.id, input.userId))
    .returning({
      authUid: systemUsers.authUid,
      officeId: systemUsers.officeId,
      employeeId: systemUsers.employeeId,
    });
  if (!updated) throw new Error("User not found");

  // Propagate the role into app_metadata (the service-role-only claim store
  // read by middleware + getCurrentUser). Without this the DB role and the
  // authorization claim drift — a demotion would otherwise leave the target's
  // elevated access intact until the next manual metadata sync.
  let claimError: string | null = null;
  if (updated.authUid) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      updated.authUid,
      {
        app_metadata: {
          role: input.role,
          office_id: updated.officeId ?? null,
          employee_id: updated.employeeId ?? null,
        },
      },
    );
    claimError = error?.message ?? null;
  }

  await auditLog({
    userId: user.id,
    action: "system_user.role_change",
    table: "system_users",
    recordId: input.userId,
    oldValues: { role: before.role },
    newValues: { role: input.role },
    outcome: claimError ? "failure" : "success",
    reason: claimError
      ? `Role saved but auth claim sync failed: ${claimError}`
      : undefined,
    module: "ADMIN",
    subModule: "user_management",
    severity: claimError ? "critical" : "warn",
  });

  revalidatePath("/settings/users");

  if (claimError) {
    throw new Error(
      "Role saved, but the sign-in claim could not be updated. Retry, or the user keeps their previous access until it syncs.",
    );
  }

  return { success: true };
}
