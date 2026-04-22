"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { withTx } from "@/lib/db/transaction";
import { lockKey } from "@/lib/concurrency";
import { z } from "zod";
import { NOTIFICATION_TEMPLATES, type NotificationTemplate } from "./templates";

const UpdateTemplateSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  emailSubject: z.string().max(200),
  emailBody: z.string().max(5000),
});

export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;

/**
 * Get all 38 notification templates with their configuration.
 * Templates are stored in system_settings with key pattern: notification_{id}_{field}
 */
export async function getNotificationTemplates(): Promise<
  NotificationTemplate[]
> {
  await requirePermission("admin", "view");

  const rows = await db.select().from(systemSettings);
  const settingsMap = new Map(rows.map((r) => [r.key, r.value]));

  return NOTIFICATION_TEMPLATES.map((t) => {
    const enabledRaw = settingsMap.get(`notification_${t.id}_enabled`);
    return {
      id: t.id,
      type: t.type,
      title: t.title,
      recipient: t.recipient,
      channel: t.channel,
      enabled: enabledRaw !== undefined ? enabledRaw === "true" : true,
      emailSubject:
        settingsMap.get(`notification_${t.id}_subject`) ??
        `[PCSO HRIS] ${t.title}`,
      emailBody:
        settingsMap.get(`notification_${t.id}_body`) ??
        `Hello,\n\n${t.title}.\n\nPlease check the PCSO HRIS portal for details.\n\nThis is an automated message from the PCSO Human Resource System.`,
    };
  });
}

/**
 * Update a notification template configuration.
 * Stores in system_settings table with keys: notification_{id}_enabled, notification_{id}_subject, notification_{id}_body
 */
export async function updateNotificationTemplate(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("admin", "edit");
    const parsed = UpdateTemplateSchema.parse(input);

    await withTx(async (tx) => {
      await lockKey(tx, `admin:settings:notification:${parsed.id}`);

      const upserts = [
        {
          key: `notification_${parsed.id}_enabled`,
          value: String(parsed.enabled),
          description: null,
        },
        {
          key: `notification_${parsed.id}_subject`,
          value: parsed.emailSubject,
          description: null,
        },
        {
          key: `notification_${parsed.id}_body`,
          value: parsed.emailBody,
          description: null,
        },
      ];

      for (const row of upserts) {
        await tx
          .insert(systemSettings)
          .values(row)
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: { value: row.value, updatedAt: new Date() },
          });
      }
    });

    void auditLog({
      userId: actor.id,
      action: "update",
      table: "system_settings",
      recordId: parsed.id,
      newValues: parsed,
    });

    revalidatePath("/admin/settings/notifications");

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0]?.message ?? "Validation failed",
      };
    }
    console.error("[notification-templates] update failed:", error);
    return { success: false, error: "Failed to update notification template" };
  }
}
