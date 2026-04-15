'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { updateUser } from '../../actions';
import { SYSTEM_ROLE_VALUES } from '@/lib/validations/admin';
import { createBrowserClient } from '@/lib/supabase/client';

const ROLE_LABELS: Record<typeof SYSTEM_ROLE_VALUES[number], string> = {
  super_admin: 'Super Admin',
  hr_admin: 'HR Admin',
  payroll_admin: 'Payroll Admin',
  leave_approver: 'Leave Approver',
  viewer: 'Viewer',
  employee_self_service: 'Employee (Self-Service)',
};

export default function EditUserPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [pending, setPending] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [role, setRole] = React.useState<typeof SYSTEM_ROLE_VALUES[number]>('employee_self_service');
  const [officeId, setOfficeId] = React.useState('');

  // Load current user values so the form is pre-populated.
  React.useEffect(() => {
    const supabase = createBrowserClient();
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('system_users')
          .select('role, office_id')
          .eq('id', id)
          .single();

        if (error || !data) {
          toast.error('Could not load user details.');
          return;
        }
        setRole((data.role as typeof SYSTEM_ROLE_VALUES[number]) ?? 'employee_self_service');
        setOfficeId((data.office_id as string | null) ?? '');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);

    try {
      await updateUser({
        id,
        role,
        officeId: officeId.trim() !== '' ? officeId.trim() : null,
      });
      toast.success('User updated successfully');
      router.push(`/admin/users/${id}`);
    } catch (err) {
      toast.error('Error', {
        description: err instanceof Error ? err.message : 'Failed to update user.',
      });
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading user…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Edit User"
        description="Update role and office scope assignment."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin', href: '/admin' },
          { label: 'Users', href: '/admin/users' },
          { label: 'Edit' },
        ]}
      />

      <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select
            value={role}
            onValueChange={(v) => setRole(v as typeof SYSTEM_ROLE_VALUES[number])}
            name="role"
          >
            <SelectTrigger id="role">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {SYSTEM_ROLE_VALUES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="officeId">Office scope (optional)</Label>
          <Input
            id="officeId"
            name="officeId"
            placeholder="Office UUID — leave blank for org-wide access"
            value={officeId}
            onChange={(e) => setOfficeId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to grant org-wide access (subject to role permissions).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={pending}
            className="bg-senate-navy text-white hover:bg-senate-navy-light"
          >
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/admin/users/${id}`)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
