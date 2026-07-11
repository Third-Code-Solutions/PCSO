/**
 * Certificate template read helpers (TOR 1.3.12 / PIM-018).
 *
 * Templates are authored/seeded in the `certificate_templates` table and drive
 * the ad hoc certificate generator. This module exposes the active-template
 * list used to populate the HR "generate ad hoc certificate" picker.
 *
 * Plain server module (no "use server"): imported by server components only.
 */

import { db } from "@/lib/db";
import { certificateTemplates } from "@/lib/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";

export interface CertificateTemplateOption {
  id: string;
  name: string;
  title: string;
}

/** Active, non-deleted certificate templates, ordered by name. */
export async function getActiveCertificateTemplates(): Promise<
  CertificateTemplateOption[]
> {
  return db
    .select({
      id: certificateTemplates.id,
      name: certificateTemplates.name,
      title: certificateTemplates.title,
    })
    .from(certificateTemplates)
    .where(
      and(
        eq(certificateTemplates.isActive, true),
        isNull(certificateTemplates.deletedAt),
      ),
    )
    .orderBy(asc(certificateTemplates.name));
}
