/**
 * Organisation profile — single-row agency identity table (PRD §P0 P0-001).
 *
 * ONE source of truth for agency name, address, logos, remittance employer IDs,
 * contact info. All PDFs, remittance exports, login panel, sidebar title, etc.
 * resolve against this table so the system can be redeployed for any agency
 * by changing one row.
 *
 * Convention: row with id = 'default' is the active profile. Additional rows
 * (e.g. branch-specific signatories in future) may coexist but are not wired
 * today.
 */

import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";

export const orgProfile = pgTable("org_profile", {
  id: varchar("id", { length: 40 }).primaryKey(),

  // ── Identity ─────────────────────────────────────────────────────────────
  agencyName: varchar("agency_name", { length: 200 }).notNull(),
  agencyShortName: varchar("agency_short_name", { length: 40 }).notNull(),
  agencyAddress: text("agency_address").notNull(),
  logoUrl: varchar("logo_url", { length: 500 }).notNull(),

  // ── Remittance employer identifiers ──────────────────────────────────────
  birTin: varchar("bir_tin", { length: 30 }),
  birAgencyName: varchar("bir_agency_name", { length: 200 }),
  philhealthEmployerNo: varchar("philhealth_employer_no", { length: 30 }),
  pagibigEmployerNo: varchar("pagibig_employer_no", { length: 30 }),
  gsisAgencyName: varchar("gsis_agency_name", { length: 200 }),
  gsisEmployerNo: varchar("gsis_employer_no", { length: 30 }),

  // ── Contact ──────────────────────────────────────────────────────────────
  contactEmail: varchar("contact_email", { length: 200 }),
  contactPhone: varchar("contact_phone", { length: 40 }),
  websiteUrl: varchar("website_url", { length: 200 }),

  // ── Legal / branding ─────────────────────────────────────────────────────
  tagline: varchar("tagline", { length: 300 }),
  copyrightHolder: varchar("copyright_holder", { length: 200 }),

  ...timestamps,
});

export type OrgProfile = typeof orgProfile.$inferSelect;
export type NewOrgProfile = typeof orgProfile.$inferInsert;

/**
 * Active profile ID. If/when multi-tenant support is added this becomes dynamic.
 */
export const DEFAULT_ORG_PROFILE_ID = "default" as const;
