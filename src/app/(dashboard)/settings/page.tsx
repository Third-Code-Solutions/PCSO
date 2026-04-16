import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/layouts/page-header';
import { requireAuth } from '@/lib/auth/guards';
import { createServerClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { systemUsers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { SettingsClient } from './_client';
import type { NotificationPrefs } from '@/lib/db/schema/users';

export const metadata = { title: 'Account Settings' };

// Any authenticated user may access their own account settings.
export default async function SettingsPage() {
  const user = await requireAuth();

  // Fetch last_sign_in_at from Supabase auth (not stored in system_users).
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const lastSignIn = authUser?.last_sign_in_at ?? null;

  // Fetch notification prefs from system_users row.
  const [row] = await db
    .select({ notificationPrefs: systemUsers.notificationPrefs })
    .from(systemUsers)
    .where(eq(systemUsers.authUid, user.id))
    .limit(1);

  const rawPrefs = (row?.notificationPrefs ?? {}) as Record<string, unknown>;

  const notificationPrefs: NotificationPrefs = {
    emailOnLeaveApproved:
      typeof rawPrefs['emailOnLeaveApproved'] === 'boolean'
        ? rawPrefs['emailOnLeaveApproved']
        : true,
    emailOnPayrollReleased:
      typeof rawPrefs['emailOnPayrollReleased'] === 'boolean'
        ? rawPrefs['emailOnPayrollReleased']
        : true,
    inAppOnly: typeof rawPrefs['inAppOnly'] === 'boolean' ? rawPrefs['inAppOnly'] : false,
  };

  return (
    <main className="space-y-6">
      <PageHeader
        title="Account Settings"
        description="Manage your personal account preferences, security, and notifications."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings' },
        ]}
        actions={<Settings className="h-5 w-5 text-muted-foreground" />}
      />

      <SettingsClient
        user={user}
        lastSignIn={lastSignIn}
        notificationPrefs={notificationPrefs}
      />
    </main>
  );
}
