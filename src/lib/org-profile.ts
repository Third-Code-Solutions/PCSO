/**
 * Agency identity resolver — reads from the single-row org_profile table
 * and falls back to PCSO literals if the row is absent (e.g. fresh dev DB
 * without seeds, build-time module evaluation, or worker contexts).
 *
 * ALL UI chrome, PDFs, remittance exports, email templates should call
 * `getOrgProfile()` instead of hardcoding the agency name.
 */

import { cache } from "react";
import { db } from "@/lib/db";
import {
  orgProfile,
  DEFAULT_ORG_PROFILE_ID,
  type OrgProfile,
} from "@/lib/db/schema/org-profile";
import { eq } from "drizzle-orm";

/**
 * Fallback values — used when the org_profile row is missing OR when running
 * outside a request context (e.g. static generation of metadata). Matches
 * the `default` row seeded by supabase/migrations/2026-04-21-org-profile-pcso.sql.
 */
export const PCSO_FALLBACK: OrgProfile = {
  id: DEFAULT_ORG_PROFILE_ID,
  agencyName: "Philippine Charity Sweepstakes Office",
  agencyShortName: "PCSO",
  agencyAddress:
    "605 Conservatory Building, Sun Plaza Complex, 1502 Shaw Boulevard, Mandaluyong City, Metro Manila",
  logoUrl: "/logos/pcso-official.png",
  birTin: "000-000-000-000",
  birAgencyName: "Philippine Charity Sweepstakes Office",
  philhealthEmployerNo: "000000000000",
  pagibigEmployerNo: "000000000000",
  gsisAgencyName: "Philippine Charity Sweepstakes Office",
  gsisEmployerNo: "000000000000",
  contactEmail: "hr@pcso.gov.ph",
  contactPhone: "+63 2 8846 8000",
  websiteUrl: "https://www.pcso.gov.ph",
  tagline:
    "Serving the Filipino people through charity, responsible gaming, and transparent governance.",
  copyrightHolder: "Philippine Charity Sweepstakes Office",
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

/**
 * Get the active org profile. Cached per request via React `cache()`.
 * Never throws — returns PCSO_FALLBACK if DB is unavailable.
 */
export const getOrgProfile = cache(async (): Promise<OrgProfile> => {
  try {
    const rows = await db
      .select()
      .from(orgProfile)
      .where(eq(orgProfile.id, DEFAULT_ORG_PROFILE_ID))
      .limit(1);
    return rows[0] ?? PCSO_FALLBACK;
  } catch {
    return PCSO_FALLBACK;
  }
});
