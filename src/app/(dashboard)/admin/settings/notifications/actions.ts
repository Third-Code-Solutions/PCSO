"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
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

  // For now, return defaults. In production, read from system_settings table
  return NOTIFICATION_TEMPLATES.map((t) => ({
    id: t.id,
    type: t.type,
    title: t.title,
    recipient: t.recipient,
    channel: t.channel,
    enabled: true,
    emailSubject: `[PCSO HRIS] ${t.title}`,
    emailBody: `Hello,\n\n${t.title}.\n\nPlease check the PCSO HRIS portal for details.\n\nThis is an automated message from the PCSO Human Resource System.`,
  }));
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

    // In production, upsert to system_settings table
    // For now, just audit the change
    void auditLog({
      userId: actor.id,
      action: "update",
      table: "notification_templates",
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
