'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Clock, Info, MonitorSmartphone } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { signOutAllSessions } from './actions';
import { describeUserAgent } from '@/lib/utils/user-agent';

interface SessionsTabProps {
  lastSignIn: string | null;
}

export function SessionsTab({ lastSignIn }: SessionsTabProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  // Resolved in an effect (not during render) to avoid an SSR hydration
  // mismatch — `navigator` does not exist on the server.
  const [deviceLabel, setDeviceLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDeviceLabel(describeUserAgent(navigator.userAgent));
  }, []);

  const formattedLastSignIn = lastSignIn
    ? new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Asia/Manila',
      }).format(new Date(lastSignIn))
    : 'Not available';

  function handleConfirm() {
    startTransition(async () => {
      try {
        await signOutAllSessions();
        toast.success('Signed out of all sessions');
        setOpen(false);
        router.push('/login');
      } catch (err) {
        toast.error('Sign out failed', {
          description: err instanceof Error ? err.message : 'Something went wrong.',
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Current Session
          </CardTitle>
          <CardDescription>
            Details about the device and session you are signed in on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Signed In Since
              </p>
              <p className="text-sm text-muted-foreground">{formattedLastSignIn}</p>
            </div>

            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <MonitorSmartphone className="h-3.5 w-3.5" aria-hidden />
                This Device
              </p>
              <p className="text-sm text-muted-foreground">{deviceLabel ?? '…'}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-muted bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Only the session on this device is shown here. If you signed in on other devices,
              use &ldquo;Sign out of all sessions&rdquo; below to revoke access everywhere at once.
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
            Signing out of all sessions will immediately revoke access on every device where you
            are currently logged in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setOpen(true)}
            disabled={pending}
          >
            {pending ? 'Signing out…' : 'Sign out of all sessions'}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of all sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke access on every device and browser where you are currently signed
              in. You will need to log in again afterwards. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending ? 'Signing out…' : 'Yes, sign me out everywhere'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
