"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AccountTab } from "./account";
import { PasswordTab } from "./password";
import { NotificationsTab } from "./notifications";
import { SessionsTab } from "./sessions";
import { DisplayTab } from "./display";
import type { CurrentUser } from "@/lib/auth/get-current-user";
import type { NotificationPrefs } from "./actions";

interface SettingsClientProps {
  user: CurrentUser;
  lastSignIn: string | null;
  notificationPrefs: NotificationPrefs;
}

export function SettingsClient({
  user,
  lastSignIn,
  notificationPrefs,
}: SettingsClientProps) {
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

      <TabsContent value="security" className="space-y-6">
        <PasswordTab />

        {/* SEC-003: TOTP management lives on its own page */}
        <Link
          href="/settings/security"
          className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 shadow-sm transition-colors hover:border-pcso-navy/40"
        >
          <span className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span>
              <span className="block text-sm font-medium">
                Two-Factor Authentication (TOTP)
              </span>
              <span className="block text-xs text-muted-foreground">
                Enroll or manage your authenticator app. Mandatory for Super
                Admin and HR Admin roles.
              </span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
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
