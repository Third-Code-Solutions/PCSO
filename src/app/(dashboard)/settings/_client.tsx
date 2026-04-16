'use client';

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AccountTab } from './account';
import { PasswordTab } from './password';
import { NotificationsTab } from './notifications';
import { SessionsTab } from './sessions';
import { DisplayTab } from './display';
import type { CurrentUser } from '@/lib/auth/get-current-user';
import type { NotificationPrefs } from './actions';

interface SettingsClientProps {
  user: CurrentUser;
  lastSignIn: string | null;
  notificationPrefs: NotificationPrefs;
}

export function SettingsClient({ user, lastSignIn, notificationPrefs }: SettingsClientProps) {
  return (
    <Tabs defaultValue="account" className="space-y-6">
      <TabsList className="grid w-full grid-cols-5 sm:w-auto sm:inline-flex">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="sessions">Sessions</TabsTrigger>
        <TabsTrigger value="display">Display</TabsTrigger>
      </TabsList>

      <TabsContent value="account">
        <AccountTab user={user} lastSignIn={lastSignIn} />
      </TabsContent>

      <TabsContent value="security">
        <PasswordTab />
      </TabsContent>

      <TabsContent value="notifications">
        <NotificationsTab initialPrefs={notificationPrefs} />
      </TabsContent>

      <TabsContent value="sessions">
        <SessionsTab lastSignIn={lastSignIn} />
      </TabsContent>

      <TabsContent value="display">
        <DisplayTab />
      </TabsContent>
    </Tabs>
  );
}
