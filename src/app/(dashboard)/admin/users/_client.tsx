'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { UsersTable, type UserRow } from '@/components/admin/users-table';

interface OfficeOption {
  id: string;
  name: string;
}

interface UsersFilterBarProps {
  initial: {
    search?: string;
    role?: string;
    status?: string;
    officeId?: string;
    pageSize?: number;
  };
  offices: OfficeOption[];
}

const ROLES = [
  { value: '', label: 'Any role' },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'hr_admin', label: 'HR Admin' },
  { value: 'payroll_admin', label: 'Payroll Admin' },
  { value: 'leave_approver', label: 'Leave Approver' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'employee_self_service', label: 'Employee' },
];

export function UsersFilterBar({ initial, offices }: UsersFilterBarProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState(initial.search ?? '');
  const [role, setRole] = React.useState(initial.role ?? '');
  const [status, setStatus] = React.useState(initial.status ?? '');
  const [officeId, setOfficeId] = React.useState(initial.officeId ?? '');
  const [pageSize, setPageSize] = React.useState(String(initial.pageSize ?? 50));

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => {
      pushParams({ search, role, status, officeId, pageSize, page: '1' });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function pushParams(vals: Record<string, string>) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(vals)) {
      if (v) sp.set(k, v);
    }
    router.push(`/admin/users?${sp.toString()}`);
  }

  function onRoleChange(v: string) {
    setRole(v);
    pushParams({ search, role: v, status, officeId, pageSize, page: '1' });
  }

  function onStatusChange(v: string) {
    setStatus(v);
    pushParams({ search, role, status: v, officeId, pageSize, page: '1' });
  }

  function onOfficeChange(v: string) {
    setOfficeId(v);
    pushParams({ search, role, status, officeId: v, pageSize, page: '1' });
  }

  function onPageSizeChange(v: string) {
    setPageSize(v);
    pushParams({ search, role, status, officeId, pageSize: v, page: '1' });
  }

  function reset() {
    setSearch('');
    setRole('');
    setStatus('');
    setOfficeId('');
    setPageSize('50');
    router.push('/admin/users');
  }

  return (
    <div className="grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
      <div className="space-y-1 lg:col-span-2">
        <Label htmlFor="u-search" className="text-xs">
          Search
        </Label>
        <Input
          id="u-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Email, first name, last name…"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="u-role" className="text-xs">
          Role
        </Label>
        <select
          id="u-role"
          value={role}
          onChange={(e) => onRoleChange(e.target.value)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="u-status" className="text-xs">
          Status
        </Label>
        <select
          id="u-status"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Any</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="u-office" className="text-xs">
          Office scope
        </Label>
        <select
          id="u-office"
          value={officeId}
          onChange={(e) => onOfficeChange(e.target.value)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Any office</option>
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="u-pageSize" className="text-xs">
          Rows / page
        </Label>
        <select
          id="u-pageSize"
          value={pageSize}
          onChange={(e) => onPageSizeChange(e.target.value)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200">200</option>
        </select>
      </div>
      <div className="flex items-end">
        <Button type="button" variant="outline" size="sm" onClick={reset}>
          Clear filters
        </Button>
      </div>
    </div>
  );
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export function UsersPagination({
  page,
  totalPages,
  total,
  pageSize,
  searchParams,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  searchParams: Record<string, string | undefined>;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  function href(nextPage: number): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== 'page') sp.set(k, v);
    }
    sp.set('page', String(nextPage));
    return `/admin/users?${sp.toString()}`;
  }

  return (
    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium">{start.toLocaleString()}</span>–
        <span className="font-medium">{end.toLocaleString()}</span> of{' '}
        <span className="font-medium">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild disabled={page <= 1}>
          <Link href={href(Math.max(1, page - 1))}>Previous</Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          Page <span className="font-medium">{page.toLocaleString()}</span> of{' '}
          <span className="font-medium">{totalPages.toLocaleString()}</span>
        </span>
        <Button variant="outline" size="sm" asChild disabled={page >= totalPages}>
          <Link href={href(Math.min(totalPages, page + 1))}>Next</Link>
        </Button>
      </div>
    </div>
  );
}

// ─── Table wrapper (passes rows through untouched) ───────────────────────────

export function UsersTableShell({ users }: { users: UserRow[] }) {
  return <UsersTable users={users} />;
}
