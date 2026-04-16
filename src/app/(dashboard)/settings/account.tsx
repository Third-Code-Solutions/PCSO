'use client';

import * as React from 'react';
import { ShieldCheck, Mail, Clock, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { CurrentUser } from '@/lib/auth/get-current-user';

interface AccountTabProps {
  user: CurrentUser;
  lastSignIn: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  hr_admin: 'HR Administrator',
  payroll_admin: 'Payroll Administrator',
  leave_approver: 'Leave Approver',
  viewer: 'Viewer',
  employee_self_service: 'Employee Self-Service',
};

export function AccountTab({ user, lastSignIn }: AccountTabProps) {
  const formattedLastSignIn = lastSignIn
    ? new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Asia/Manila',
      }).format(new Date(lastSignIn))
    : 'Not available';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          Account Information
        </CardTitle>
        <CardDescription>
          Your account details are managed by the system administrator.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Email Address
          </p>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{user.email}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Read-only
            </span>
          </div>
        </div>

        <Separator />

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</p>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Read-only
            </span>
          </div>
        </div>

        <Separator />

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Last Sign-In
          </p>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{formattedLastSignIn}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
