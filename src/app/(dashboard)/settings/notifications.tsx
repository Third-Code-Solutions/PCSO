'use client';

import * as React from 'react';
import { Bell } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { updateNotificationPrefs, type NotificationPrefs } from './actions';

interface NotificationsTabProps {
  initialPrefs: NotificationPrefs;
}

const DEFAULT_PREFS: Required<NotificationPrefs> = {
  emailOnLeaveApproved: true,
  emailOnPayrollReleased: true,
  inAppOnly: false,
};

export function NotificationsTab({ initialPrefs }: NotificationsTabProps) {
  const [pending, startTransition] = React.useTransition();
  const [prefs, setPrefs] = React.useState<Required<NotificationPrefs>>({
    ...DEFAULT_PREFS,
    ...initialPrefs,
  });

  function toggle(key: keyof Required<NotificationPrefs>) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateNotificationPrefs(prefs);
        toast.success('Notification preferences saved');
      } catch (err) {
        toast.error('Failed to save preferences', {
          description: err instanceof Error ? err.message : 'Something went wrong.',
        });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Control which events send you email notifications. In-app notifications are always
          delivered regardless of these settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset disabled={pending} className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm font-medium">Email Notifications</p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="emailOnLeaveApproved"
                    checked={prefs.emailOnLeaveApproved}
                    onCheckedChange={() => toggle('emailOnLeaveApproved')}
                    disabled={prefs.inAppOnly}
                  />
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="emailOnLeaveApproved"
                      className={
                        prefs.inAppOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                      }
                    >
                      Leave application approved
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Receive an email when your leave application is approved or denied.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="emailOnPayrollReleased"
                    checked={prefs.emailOnPayrollReleased}
                    onCheckedChange={() => toggle('emailOnPayrollReleased')}
                    disabled={prefs.inAppOnly}
                  />
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="emailOnPayrollReleased"
                      className={
                        prefs.inAppOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                      }
                    >
                      Payroll released
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Receive an email when your payslip is ready for the pay period.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">Delivery Mode</p>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="inAppOnly"
                  checked={prefs.inAppOnly}
                  onCheckedChange={() => toggle('inAppOnly')}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="inAppOnly" className="cursor-pointer">
                    In-app notifications only
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Suppress all email notifications. You will still see alerts inside the
                    application.
                  </p>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={pending}
              className="bg-senate-navy text-white hover:bg-senate-navy-light"
            >
              {pending ? 'Saving…' : 'Save Preferences'}
            </Button>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
