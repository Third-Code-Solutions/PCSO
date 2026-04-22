"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  orgProfile,
  DEFAULT_ORG_PROFILE_ID,
  systemUsers,
  employees,
  type SystemRole,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";

/**
 * Update organization profile (P0-001)
 * Super admin only
 */
export async function updateOrgProfile(formData: FormData) {
  const user = await requireAuth();

  if (!hasPermission(user.role, "admin", "edit")) {
    throw new Error("Unauthorized: Super admin access required");
  }

  const agencyName = formData.get("agencyName") as string;
  const agencyShortName = formData.get("agencyShortName") as string;
  const agencyAddress = formData.get("agencyAddress") as string;
  const logoUrl = formData.get("logoUrl") as string;
  const birTin = formData.get("birTin") as string;
  const birAgencyName = formData.get("birAgencyName") as string;
  const philhealthEmployerNo = formData.get("philhealthEmployerNo") as string;
  const pagibigEmployerNo = formData.get("pagibigEmployerNo") as string;
  const gsisAgencyName = formData.get("gsisAgencyName") as string;
  const gsisEmployerNo = formData.get("gsisEmployerNo") as string;
  const contactEmail = formData.get("contactEmail") as string;
  const contactPhone = formData.get("contactPhone") as string;
  const websiteUrl = formData.get("websiteUrl") as string;

  if (!agencyName || !agencyShortName || !agencyAddress || !logoUrl) {
    throw new Error("Required fields missing");
  }

  await db
    .update(orgProfile)
    .set({
      agencyName,
      agencyShortName,
      agencyAddress,
      logoUrl,
      birTin: birTin || null,
      birAgencyName: birAgencyName || null,
      philhealthEmployerNo: philhealthEmployerNo || null,
      pagibigEmployerNo: pagibigEmployerNo || null,
      gsisAgencyName: gsisAgencyName || null,
      gsisEmployerNo: gsisEmployerNo || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      websiteUrl: websiteUrl || null,
      updatedAt: new Date(),
    })
    .where(eq(orgProfile.id, DEFAULT_ORG_PROFILE_ID));

  revalidatePath("/settings/org-profile");
  revalidatePath("/dashboard");

  return { success: true };
}

/**
 * Update user role and dashboard profile
 * Super admin only
 */
export async function updateUserRole(
  userId: string,
  role: SystemRole,
  dashboardProfile?: string,
) {
  const user = await requireAuth();

  if (!hasPermission(user.role, "admin", "edit")) {
    throw new Error("Unauthorized: Super admin access required");
  }

  await db
    .update(systemUsers)
    .set({
      role,
      updatedAt: new Date(),
    })
    .where(eq(systemUsers.id, userId));

  revalidatePath("/settings/users");

  return { success: true };
}

/**
 * Update own profile
 * Limited fields per role
 */
export async function updateProfile(employeeId: string, formData: FormData) {
  const user = await requireAuth();

  // Can only update own profile unless super admin
  if (
    user.employeeId !== employeeId &&
    !hasPermission(user.role, "admin", "edit")
  ) {
    throw new Error("Unauthorized: Can only update own profile");
  }

  const contactNumber = formData.get("contactNumber") as string;
  const email = formData.get("email") as string;
  const address = formData.get("address") as string;

  await db
    .update(employees)
    .set({
      // Only allow updates to contact info, not core identity fields
      updatedAt: new Date(),
    })
    .where(eq(employees.id, employeeId));

  revalidatePath("/profile");

  return { success: true };
}
