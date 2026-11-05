import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { requireAuth } from "@/lib/auth/guards";
import { isMfaEnforcedRole } from "@/lib/auth/mfa";
import { SecurityClient } from "./_client";

export const metadata = { title: "Security — Two-Factor Authentication" };

/**
 * Two-factor authentication management — TOR 3.2.6 / SEC-003.
 *
 * Any authenticated user may enroll a TOTP factor; super_admin and hr_admin
 * are REQUIRED to: requireAuth / requirePermission redirect them here until
 * enrolled. This page passes `allowAal1` so that redirect cannot loop.
 */
export default async function SecuritySettingsPage() {
  const user = await requireAuth({ allowAal1: true });
  const isMandatory = isMfaEnforcedRole(user.role);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Two-Factor Authentication"
        description="Protect your account with a time-based one-time password (TOTP) from an authenticator app."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Security" },
        ]}
        actions={<ShieldCheck className="h-5 w-5 text-muted-foreground" />}
      />

      <SecurityClient isMandatory={isMandatory} role={user.role} />
    </main>
  );
}
