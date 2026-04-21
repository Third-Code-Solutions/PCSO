/**
 * Per-document serial sequence counters.
 *
 * Used by RPM (MRF-YYYY-NNNNNN, CSC9-YYYY-NNNNNN, TRUN-YYYY-NNNNNN),
 * LDM (CT-YYYY-NNNNNN certificates), EWBM (loyalty/retirement notice numbers),
 * and any other module that needs a monotonic per-year counter.
 *
 * Increment pattern (raw SQL, atomic):
 *   INSERT INTO public.serial_sequences (document_type, year, last_sequence)
 *   VALUES ($1, $2, 1)
 *   ON CONFLICT (document_type, year)
 *   DO UPDATE SET last_sequence = serial_sequences.last_sequence + 1,
 *                 updated_at = now()
 *   RETURNING last_sequence;
 */

import {
  pgTable,
  varchar,
  smallint,
  integer,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

export const serialSequences = pgTable(
  "serial_sequences",
  {
    documentType: varchar("document_type", { length: 40 }).notNull(),
    year: smallint("year").notNull(),
    lastSequence: integer("last_sequence").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.documentType, t.year] }),
  }),
);

export type SerialSequence = typeof serialSequences.$inferSelect;
export type NewSerialSequence = typeof serialSequences.$inferInsert;
