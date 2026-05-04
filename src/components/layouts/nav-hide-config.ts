/**
 * Temporary navigation hide list.
 *
 * HOW TO RESTORE: remove the href from the array below (or delete the role key
 * entirely to restore all items for that role).  No routes, server actions, or
 * DB permissions are changed — this is purely a nav-tree filter.
 *
 * Keys are Role values.  Each value is the list of hrefs to suppress for that
 * role.  Redundant entries (items the role cannot see anyway) are harmless.
 */

import type { Role } from "@/lib/auth/permissions";

export const HIDDEN_ROUTES: Partial<Record<Role, readonly string[]>> = {
  // ── Employee Self-Service ─────────────────────────────────────────────────
  employee_self_service: [
    // SALN — entire section
    "/saln/admin",
    "/saln/submissions",
    "/saln/tracking",
    "/saln/admin/non-filers",
    "/saln/new",

    // Performance — DPCR and BPCR only (other performance links stay)
    "/performance/dpcr",
    "/performance/bpcr",

    // Learning & Development — entire section
    "/learning",
    "/learning/catalog",
    "/learning/providers",
    "/learning/schedule",
    "/learning/tna",
    "/learning/mandatory",
    "/learning/certificates",
    "/learning/reports",
    "/portal/training",
  ],

  // ── HR Administrator ──────────────────────────────────────────────────────
  hr_admin: [
    // Employees — Plantilla and New Position only
    "/plantilla",
    "/plantilla/new",

    // Leave — Adjust Credits
    "/leave/credits/adjust",

    // SALN — entire section
    "/saln",
    "/saln/admin",
    "/saln/submissions",
    "/saln/tracking",
    "/saln/admin/non-filers",
    "/saln/new",

    // Payroll — specific types
    "/payroll/cash-advance",
    "/payroll/differential",
    "/payroll/loans",
    "/payroll/rata",
    "/payroll/special",
    "/payroll/magna-carta",
    "/payroll/bank-configs",

    // Performance — specific items
    "/performance/step-increments",
    "/performance/dpcr",
    "/performance/bpcr",
    "/performance/pbb",
    "/performance/analytics",

    // Learning & Development — entire section
    "/learning",
    "/learning/catalog",
    "/learning/providers",
    "/learning/schedule",
    "/learning/tna",
    "/learning/mandatory",
    "/learning/certificates",
    "/learning/reports",
    "/portal/training",

    // Welfare & PRAISE — entire section
    "/welfare",
    "/welfare/loyalty",
    "/welfare/retirement",
    "/welfare/praise",
    "/welfare/wellness",
    "/reports/workforce/loyalty",
    "/reports/workforce/retirement",
  ],
};
