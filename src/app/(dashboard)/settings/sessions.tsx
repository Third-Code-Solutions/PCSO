'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Clock, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { signOutAllSessions } from './actions';

interface SessionsTabProps {
  lastSignIn: string | null;
}

export function SessionsTab({ lastSignIn }: SessionsTabProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const formattedLastSignIn = lastSignIn
    ? new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Asia/Manila',
      }).format(new Date(lastSignIn))
    : 'Not available';

  async function handleSignOutAll() {
    if (
      !window.confirm(
        'This will sign you out of all devices and browsers. You will need to log in again. Continue?',
      )
    ) {
      return;
    }

    setPending(true);
    try {
      await signOutAllSessions();
      toast.success('Signed out of all sessions');
      router.push('/login');
    } catch (err) {
      toast.error('Sign out failed', {
        description: err instanceof Error ? err.message : 'Something went wrong.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Current Session
          </CardTitle>
          <CardDescription>Details about the device and session you are signed in on.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Last Sign-In
            </p>
            <p className="text-sm text-muted-foreground">{formattedLastSignIn}</p>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-muted bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Individual session tracking per device is coming soon. For now, use "Sign out of all
              sessions" below to revoke access everywhere at once.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <LogOut className="h-4 w-4" />
            Sign Out Everywhere
          </CardTitle>
          <CardDescription>
            Signing out of all sessions will immediately revoke access on every device where you are
            currently logged in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleSignOutAll} disabled={pending}>
            {pending ? 'Signing out…' : 'Sign out of all sessions'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
