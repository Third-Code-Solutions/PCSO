/**
 * Certificate Templates — TOR 1.3.12 / 1.2.29 / 1.3.26 (PIM-018)
 *
 * Ad hoc certificate engine: HRD manages templates whose body contains
 * {{placeholder}} tokens substituted from the employee 201 file at generation
 * time (see src/lib/utils/documents/template-render.ts). Generated PDFs carry
 * serial AHC-YYYY-NNNNNN from the centralized serial sequence system.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { timestamps, softDelete } from "./_shared";

export const certificateTemplates = pgTable(
  "certificate_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull().unique(),
    /** Document title rendered on the certificate (may contain placeholders). */
    title: varchar("title", { length: 200 }).notNull(),
    /** Body text with {{placeholder}} tokens. Blank line = paragraph break. */
    bodyTemplate: text("body_template").notNull(),
    /** Optional fm_document_signatories.document_type_code for the signature block. */
    signatoryDocTypeCode: varchar("signatory_doc_type_code", { length: 30 }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index("certificate_templates_active_idx").on(t.isActive)],
);

export type CertificateTemplate = typeof certificateTemplates.$inferSelect;
export type NewCertificateTemplate = typeof certificateTemplates.$inferInsert;
