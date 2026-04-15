import type { Metadata } from 'next';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layouts/page-header';
import { UsersTable, type UserRow } from '@/components/admin/users-table';
import { requirePermission } from '@/lib/auth/guards';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'User Management — Admin',
};

async function getUsers(): Promise<UserRow[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('system_users')
    .select(
      `
      id,
      email,
      role,
      is_active,
      last_login,
      created_at,
      offices(name),
      employees(first_name, last_name)
    `,
    )
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch users: ${error.message}`);

  return (data ?? []).map((row) => {
    const office = Array.isArray(row.offices) ? row.offices[0] : row.offices;
    const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees;
    return {
      id: row.id as string,
      email: row.email as string,
      role: row.role as string,
      officeName: (office as { name: string } | null)?.name ?? null,
      employeeName: employee
        ? `${(employee as { first_name: string }).first_name} ${(employee as { last_name: string }).last_name}`
        : null,
      isActive: row.is_active as boolean,
      lastLogin: row.last_login as string | null,
      createdAt: row.created_at as string,
    };
  });
}

export default async function AdminUsersPage() {
  await requirePermission('admin', 'view');
  const users = await getUsers();

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="User Management"
        description={`${users.length} system account${users.length !== 1 ? 's' : ''}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin', href: '/admin' },
          { label: 'Users' },
        ]}
        actions={
          <Button
            asChild
            size="sm"
            className="gap-2 bg-senate-navy text-white hover:bg-senate-navy-light"
          >
            <Link href="/admin/users/new">
              <UserPlus className="h-4 w-4" />
              Add User
            </Link>
          </Button>
        }
      />

      <UsersTable users={users} />
    </div>
  );
}
