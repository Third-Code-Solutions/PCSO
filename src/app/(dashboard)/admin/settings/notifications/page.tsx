import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { NotificationTemplatesClient } from "./_client";
import { getNotificationTemplates } from "./actions";

export const metadata: Metadata = { title: "Notification Templates — Admin" };

export default async function NotificationTemplatesPage() {
  await requirePermission("admin", "view");
  const templates = await getNotificationTemplates();

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Notification Templates"
        description="Configure the 38 system notification templates defined in PRD Section 13. Toggle enable/disable and customize email content per template."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin" },
          { label: "Settings", href: "/admin/settings" },
          { label: "Notifications" },
        ]}
      />

      <NotificationTemplatesClient templates={templates} />
    </div>
  );
}
