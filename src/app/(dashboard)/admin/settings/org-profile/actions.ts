"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  orgProfile,
  DEFAULT_ORG_PROFILE_ID,
} from "@/lib/db/schema/org-profile";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { withTx } from "@/lib/db/transaction";
import { lockKey } from "@/lib/concurrency";
import { eq } from "drizzle-orm";
import { z } from "zod";

// ─── Schema ──────────────────────────────────────────────────────────────────

const OrgProfileSchema = z.object({
  agencyName: z.string().min(1, "Agency name is required").max(200),
  agencyShortName: z.string().min(1, "Short name is required").max(40),
  agencyAddress: z.string().min(1, "Address is required"),
  logoUrl: z.string().url("Must be a valid URL").max(500),
  birTin: z.string().max(30).optional(),
  birAgencyName: z.string().max(200).optional(),
  philhealthEmployerNo: z.string().max(30).optional(),
  pagibigEmployerNo: z.string().max(30).optional(),
  gsisAgencyName: z.string().max(200).optional(),
  gsisEmployerNo: z.string().max(30).optional(),
  contactEmail: z.string().email("Invalid email").max(200).optional(),
  contactPhone: z.string().max(40).optional(),
  websiteUrl: z.string().url("Must be a valid URL").max(200).optional(),
  tagline: z.string().max(300).optional(),
  copyrightHolder: z.string().max(200).optional(),
});

export type OrgProfileInput = z.infer<typeof OrgProfileSchema>;

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getOrgProfile(): Promise<OrgProfileInput> {
  await requirePermission("admin", "view");

  const [row] = await db
    .select()
    .from(orgProfile)
    .where(eq(orgProfile.id, DEFAULT_ORG_PROFILE_ID))
    .limit(1);

  if (!row) {
    // Return default values if no profile exists yet
    return {
      agencyName: "Philippine Charity Sweepstakes Office",
      agencyShortName: "PCSO",
      agencyAddress:
        "605 Shaw Boulevard, Mandaluyong City, Metro Manila, Philippines 1552",
      logoUrl: "/pcso-seal.png",
      birTin: "",
      birAgencyName: "Philippine Charity Sweepstakes Office",
      philhealthEmployerNo: "",
      pagibigEmployerNo: "",
      gsisAgencyName: "Philippine Charity Sweepstakes Office",
      gsisEmployerNo: "",
      contactEmail: "info@pcso.gov.ph",
      contactPhone: "+63 2 8733 8877",
      websiteUrl: "https://www.pcso.gov.ph",
      tagline: "Kaya natin, para sa bayan",
      copyrightHolder: "Philippine Charity Sweepstakes Office",
    };
  }

  return {
    agencyName: row.agencyName,
    agencyShortName: row.agencyShortName,
    agencyAddress: row.agencyAddress,
    logoUrl: row.logoUrl,
    birTin: row.birTin ?? undefined,
    birAgencyName: row.birAgencyName ?? undefined,
    philhealthEmployerNo: row.philhealthEmployerNo ?? undefined,
    pagibigEmployerNo: row.pagibigEmployerNo ?? undefined,
    gsisAgencyName: row.gsisAgencyName ?? undefined,
    gsisEmployerNo: row.gsisEmployerNo ?? undefined,
    contactEmail: row.contactEmail ?? undefined,
    contactPhone: row.contactPhone ?? undefined,
    websiteUrl: row.websiteUrl ?? undefined,
    tagline: row.tagline ?? undefined,
    copyrightHolder: row.copyrightHolder ?? undefined,
  };
}

export async function saveOrgProfile(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("admin", "edit");
    const parsed = OrgProfileSchema.parse(input);

    const oldValues = await getOrgProfile();

    await withTx(async (tx) => {
      await lockKey(tx, "admin:org_profile");

      await tx
        .insert(orgProfile)
        .values({
          id: DEFAULT_ORG_PROFILE_ID,
          agencyName: parsed.agencyName,
          agencyShortName: parsed.agencyShortName,
          agencyAddress: parsed.agencyAddress,
          logoUrl: parsed.logoUrl,
          birTin: parsed.birTin ?? null,
          birAgencyName: parsed.birAgencyName ?? null,
          philhealthEmployerNo: parsed.philhealthEmployerNo ?? null,
          pagibigEmployerNo: parsed.pagibigEmployerNo ?? null,
          gsisAgencyName: parsed.gsisAgencyName ?? null,
          gsisEmployerNo: parsed.gsisEmployerNo ?? null,
          contactEmail: parsed.contactEmail ?? null,
          contactPhone: parsed.contactPhone ?? null,
          websiteUrl: parsed.websiteUrl ?? null,
          tagline: parsed.tagline ?? null,
          copyrightHolder: parsed.copyrightHolder ?? null,
        })
        .onConflictDoUpdate({
          target: orgProfile.id,
          set: {
            agencyName: parsed.agencyName,
            agencyShortName: parsed.agencyShortName,
            agencyAddress: parsed.agencyAddress,
            logoUrl: parsed.logoUrl,
            birTin: parsed.birTin ?? null,
            birAgencyName: parsed.birAgencyName ?? null,
            philhealthEmployerNo: parsed.philhealthEmployerNo ?? null,
            pagibigEmployerNo: parsed.pagibigEmployerNo ?? null,
            gsisAgencyName: parsed.gsisAgencyName ?? null,
            gsisEmployerNo: parsed.gsisEmployerNo ?? null,
            contactEmail: parsed.contactEmail ?? null,
            contactPhone: parsed.contactPhone ?? null,
            websiteUrl: parsed.websiteUrl ?? null,
            tagline: parsed.tagline ?? null,
            copyrightHolder: parsed.copyrightHolder ?? null,
            updatedAt: new Date(),
          },
        });
    });

    void auditLog({
      userId: actor.id,
      action: "update",
      table: "org_profile",
      recordId: DEFAULT_ORG_PROFILE_ID,
      oldValues,
      newValues: parsed,
    });

    revalidatePath("/admin/settings/org-profile");
    revalidatePath("/", "layout"); // Revalidate entire site for navbar/footer

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0]?.message ?? "Validation failed",
      };
    }
    console.error("[org-profile] save failed:", error);
    return { success: false, error: "Failed to save organization profile" };
  }
}
