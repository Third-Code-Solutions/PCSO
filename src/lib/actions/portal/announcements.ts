"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import {
  announcements,
  announcementAcknowledgements,
} from "@/lib/db/schema/announcements";
import { requireAuth } from "@/lib/auth/guards";
import { eq, and, desc } from "drizzle-orm";
import { auditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

/**
 * Fetch all announcements visible to the current employee
 */
export async function getAnnouncements() {
  const user = await requireAuth();

  if (!user.employeeId) {
    return { success: false as const, error: "No employee record linked" };
  }

  const items = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      content: announcements.content,
      type: announcements.type,
      publishedAt: announcements.publishedAt,
      expiresAt: announcements.expiresAt,
      acknowledged: announcementAcknowledgements.acknowledgedAt,
    })
    .from(announcements)
    .leftJoin(
      announcementAcknowledgements,
      and(
        eq(announcementAcknowledgements.announcementId, announcements.id),
        eq(announcementAcknowledgements.employeeId, user.employeeId),
      ),
    )
    .where(eq(announcements.isActive, true))
    .orderBy(desc(announcements.publishedAt));

  return { success: true as const, data: items };
}

/**
 * Acknowledge an announcement
 */
export async function acknowledgeAnnouncement(announcementId: string) {
  const user = await requireAuth();

  if (!user.employeeId) {
    return { success: false as const, error: "No employee record linked" };
  }

  // Check if already acknowledged
  const [existing] = await db
    .select()
    .from(announcementAcknowledgements)
    .where(
      and(
        eq(announcementAcknowledgements.announcementId, announcementId),
        eq(announcementAcknowledgements.employeeId, user.employeeId),
      ),
    )
    .limit(1);

  if (existing) {
    return { success: false as const, error: "Already acknowledged" };
  }

  await db.insert(announcementAcknowledgements).values({
    announcementId,
    employeeId: user.employeeId,
    acknowledgedAt: new Date(),
  });

  await auditLog({
    userId: user.id,
    action: "acknowledge_announcement",
    table: "announcement_acknowledgements",
    recordId: announcementId,
    newValues: { announcementId, employeeId: user.employeeId },
  });

  revalidatePath("/portal/announcements");
  return { success: true as const };
}
