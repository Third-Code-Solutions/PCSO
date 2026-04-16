/**
 * /performance/cycles/new — Create a new Performance Cycle (semester).
 *
 * HR-admin only. Defaults to the current semester's start/end dates.
 */

import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { NewCycleForm } from './_client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New Performance Cycle',
};

export default async function NewPerformanceCyclePage() {
  await requirePermission('performance', 'create');

  const now = new Date();
  const year = now.getFullYear();
  const semester: '1' | '2' = now.getMonth() < 6 ? '1' : '2';

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <PageHeader
        title="New Performance Cycle"
        description="Create a rating period (semester) with its rating window."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Performance', href: '/performance' },
          { label: 'Cycles', href: '/performance/cycles' },
          { label: 'New' },
        ]}
      />

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <NewCycleForm defaultYear={year} defaultSemester={semester} />
        <div className="mt-4 border-t pt-4 text-xs text-muted-foreground">
          <Link
            href="/performance/cycles"
            className="text-senate-navy hover:underline"
          >
            ← Back to cycles list
          </Link>
        </div>
      </div>
    </main>
  );
}
