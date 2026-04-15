'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { saveSystemSettings, getSystemSettings } from './actions';
import type { SystemSettingsInput } from '@/lib/validations/admin';

export default function SettingsPage() {
  const [pending, setPending] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [settings, setSettings] = React.useState<SystemSettingsInput>({
    orgName: 'Senate of the Philippines',
    logoUrl: '',
    orgAddress: '',
    emailFrom: '',
    payrollFirstCutoffDay: 15,
    payrollFirstReleaseDay: 20,
    payrollSecondCutoffDay: 31,
    payrollSecondReleaseDayOfNextMonth: 5,
  });

  React.useEffect(() => {
    getSystemSettings()
      .then((data) => setSettings(data))
      .catch((err) => {
        toast.error('Error', {
          description: err instanceof Error ? err.message : 'Failed to load settings.',
        });
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField<K extends keyof SystemSettingsInput>(key: K, value: SystemSettingsInput[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await saveSystemSettings(settings);
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error('Error', {
        description: err instanceof Error ? err.message : 'Failed to save settings.',
      });
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="System Settings"
        description="Organization profile, branding, and payroll schedule configuration."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin', href: '/admin' },
          { label: 'Settings' },
        ]}
      />

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {/* Organization */}
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={settings.orgName}
                onChange={(e) => updateField('orgName', e.target.value)}
                placeholder="Senate of the Philippines"
                required
              />
              <p className="text-xs text-muted-foreground">
                Displayed in reports, payslips, and document headers.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                value={settings.logoUrl ?? ''}
                onChange={(e) => updateField('logoUrl', e.target.value)}
                placeholder="https://cdn.example.com/senate-seal.png"
              />
              <p className="text-xs text-muted-foreground">
                Must be publicly accessible. Used in PDF documents and the top-nav.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgAddress">Organization Address</Label>
              <Input
                id="orgAddress"
                value={settings.orgAddress ?? ''}
                onChange={(e) => updateField('orgAddress', e.target.value)}
                placeholder="Financial Center, Roxas Blvd, Pasay City, 1300 Metro Manila"
              />
            </div>
          </CardContent>
        </Card>

        {/* Email */}
        <Card>
          <CardHeader>
            <CardTitle>Email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emailFrom">From Address</Label>
              <Input
                id="emailFrom"
                type="email"
                value={settings.emailFrom ?? ''}
                onChange={(e) => updateField('emailFrom', e.target.value)}
                placeholder="noreply@senate.gov.ph"
              />
              <p className="text-xs text-muted-foreground">
                Overrides Supabase's default from address for system-generated emails.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Payroll schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Payroll Cutoff Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Separator className="my-1" />
            <p className="text-sm font-medium">First payroll (1st–15th period)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pFirstCutoff">Cutoff Day (day of month)</Label>
                <Input
                  id="pFirstCutoff"
                  type="number"
                  min={1}
                  max={28}
                  value={settings.payrollFirstCutoffDay}
                  onChange={(e) =>
                    updateField('payrollFirstCutoffDay', parseInt(e.target.value, 10))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pFirstRelease">Release Day (day of same month)</Label>
                <Input
                  id="pFirstRelease"
                  type="number"
                  min={1}
                  max={31}
                  value={settings.payrollFirstReleaseDay}
                  onChange={(e) =>
                    updateField('payrollFirstReleaseDay', parseInt(e.target.value, 10))
                  }
                />
              </div>
            </div>

            <Separator className="my-1" />
            <p className="text-sm font-medium">Second payroll (16th–end period)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pSecondCutoff">Cutoff Day (last day of month = 31)</Label>
                <Input
                  id="pSecondCutoff"
                  type="number"
                  min={1}
                  max={31}
                  value={settings.payrollSecondCutoffDay}
                  onChange={(e) =>
                    updateField('payrollSecondCutoffDay', parseInt(e.target.value, 10))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pSecondRelease">Release Day (day of following month)</Label>
                <Input
                  id="pSecondRelease"
                  type="number"
                  min={1}
                  max={10}
                  value={settings.payrollSecondReleaseDayOfNextMonth}
                  onChange={(e) =>
                    updateField(
                      'payrollSecondReleaseDayOfNextMonth',
                      parseInt(e.target.value, 10),
                    )
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          disabled={pending}
          className="bg-senate-navy text-white hover:bg-senate-navy-light"
        >
          {pending ? 'Saving…' : 'Save settings'}
        </Button>
      </form>
    </div>
  );
}
