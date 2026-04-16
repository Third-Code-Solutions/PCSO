import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    type: varchar('type', { length: 64 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body'),
    actionUrl: varchar('action_url', { length: 512 }),
    entityType: varchar('entity_type', { length: 64 }),
    entityId: uuid('entity_id'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('notifications_user_all_idx').on(t.userId, t.createdAt),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
