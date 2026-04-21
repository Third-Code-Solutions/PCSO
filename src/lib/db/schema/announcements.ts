/**
 * Announcements / Memorandums Module — EPM-003
 * HR posts memorandums; employees view and acknowledge
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps } from "./_shared";
import { employees } from "./employees";

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull(),
    type: varchar("type", { length: 30 }).notNull().default("memorandum"), // memorandum | circular | notice
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    postedByEmployeeId: uuid("posted_by_employee_id")
      .notNull()
      .references(() => employees.id),
    ...timestamps,
  },
  (t) => [index("announcements_published_at_idx").on(t.publishedAt)],
);

export const announcementAcknowledgements = pgTable(
  "announcement_acknowledgements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcements.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (t) => [
    index("announcement_acks_announcement_idx").on(t.announcementId),
    index("announcement_acks_employee_idx").on(t.employeeId),
  ],
);

export const announcementsRelations = relations(
  announcements,
  ({ one, many }) => ({
    postedBy: one(employees, {
      fields: [announcements.postedByEmployeeId],
      references: [employees.id],
    }),
    acknowledgements: many(announcementAcknowledgements),
  }),
);

export const announcementAcknowledgementsRelations = relations(
  announcementAcknowledgements,
  ({ one }) => ({
    announcement: one(announcements, {
      fields: [announcementAcknowledgements.announcementId],
      references: [announcements.id],
    }),
    employee: one(employees, {
      fields: [announcementAcknowledgements.employeeId],
      references: [employees.id],
    }),
  }),
);

export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
export type AnnouncementAcknowledgement =
  typeof announcementAcknowledgements.$inferSelect;
export type NewAnnouncementAcknowledgement =
  typeof announcementAcknowledgements.$inferInsert;
