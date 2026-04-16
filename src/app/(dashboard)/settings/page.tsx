import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/layouts/page-header';
import { requireAuth } from '@/lib/auth/guards';
import { createServerClient } from '@/lib/supabase/server';
import { SettingsClient } from './_client';
import { getNotificationPrefs } from './actions';

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

  // Load normalized notification preferences via our own reader to ensure
  // defaults and type narrowing are applied consistently.
  const notificationPrefs = await getNotificationPrefs();

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
