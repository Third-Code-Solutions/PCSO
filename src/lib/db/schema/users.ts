import {
  pgTable,
  uuid,
  varchar,
  boolean,
  pgEnum,
  text,
  index,
  uniqueIndex,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps } from "./_shared";
import { employees } from "./employees";
import { offices } from "./offices";

// ─── Enums ───────────────────────────────────────────────────────────────────

/**
 * Role enum — must stay in sync with src/lib/auth/permissions.ts Role type.
 * The Role type in permissions.ts is the authoritative TS definition;
 * this enum is the DB-level constraint.
 */
export const systemRoleEnum = pgEnum("system_role", [
  "super_admin",
  "hr_admin",
  "payroll_admin",
  "leave_approver",
  "viewer",
  "employee_self_service",
  // PCSO PRD §3.4 seven-dashboard roles. Legacy values above remain permitted
  // for existing rows; new accounts should use these.
  "supervisor",
  "executive",
  "auditor",
]);

// ─── Table ───────────────────────────────────────────────────────────────────

export const systemUsers = pgTable(
  "system_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Linked employee record — nullable for system/service accounts
     * that have no physical employee record.
     */
    employeeId: uuid("employee_id").references(() => employees.id),
    email: varchar("email", { length: 255 }).notNull().unique(),
    role: systemRoleEnum("role").notNull().default("employee_self_service"),
    /**
     * Optional office scope — limits visibility to a single office.
     * NULL = org-wide access (subject to role permissions).
     */
    officeId: uuid("office_id").references(() => offices.id),
    isActive: boolean("is_active").notNull().default(true),
    lastLogin: timestamp("last_login", { withTimezone: true }),
    /** Supabase Auth UID — used to link to auth.users */
    authUid: text("auth_uid").unique(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("system_users_email_idx").on(t.email),
    index("system_users_employee_id_idx").on(t.employeeId),
    index("system_users_role_idx").on(t.role),
    index("system_users_is_active_idx").on(t.isActive),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const systemUsersRelations = relations(systemUsers, ({ one }) => ({
  employee: one(employees, {
    fields: [systemUsers.employeeId],
    references: [employees.id],
  }),
  office: one(offices, {
    fields: [systemUsers.officeId],
    references: [offices.id],
  }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type SystemUser = typeof systemUsers.$inferSelect;
export type NewSystemUser = typeof systemUsers.$inferInsert;
export type SystemRole = (typeof systemRoleEnum.enumValues)[number];
