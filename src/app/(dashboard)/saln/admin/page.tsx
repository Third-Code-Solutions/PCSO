/**
 * /saln/admin — SALN Compliance Tracker
 *
 * Super-admin-only view of all employees' annual SALN filing status.
 * Supports bulk reminder emails and CSV export for COA submission.
 *
 * Access: super_admin only.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UsersIcon } from 'lucide-react';
import { requirePermission } from '@/lib/auth/guards';
import { getSalnComplianceForYear } from '@/app/(dashboard)/saln/queries';
import { sendReminders, exportDocuments } from '@/app/(dashboard)/saln/actions';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';
import { ComplianceDashboard } from '@/components/saln/compliance-dashboard';
import { currentCoverageYear } from '@/lib/utils/saln/deadline';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface AdminSalnPageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function AdminSalnPage({ searchParams }: AdminSalnPageProps) {
  const user = await requirePermission('saln', 'approve');

  // Gate to super_admin only
  if (user.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const resolvedParams = await searchParams;
  const year = resolvedParams.year
    ? parseInt(resolvedParams.year, 10)
    : currentCoverageYear();

  const rows = await getSalnComplianceForYear(year);

  // Build year options for the last 5 years
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 - i);

  return (
    <div>
      <RealtimeBoundary tables={['saln_submissions']} />
      <PageHeader
        title="SALN Compliance Tracker"
        description={`Annual SALN filing status for Calendar Year ${year}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'SALN Admin' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {/* Year selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Year:</span>
              <div className="flex gap-1">
                {yearOptions.map((y) => (
                  <Link
                    key={y}
                    href={`/saln/admin?year=${y}`}
                    className={`rounded px-2.5 py-1 text-sm font-medium transition-colors ${
                      y === year
                        ? 'bg-senate-navy text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {y}
                  </Link>
                ))}
              </div>
            </div>

            <Button asChild variant="outline" size="sm">
              <Link href="/saln/admin/non-filers">
                <UsersIcon className="mr-1.5 h-4 w-4" aria-hidden />
                Non-Filers List
              </Link>
            </Button>
          </div>
        }
      />

      <ComplianceDashboard
        rows={rows}
        year={year}
        onSendReminders={async (employeeIds: string[]) => {
          'use server';
          const result = await sendReminders({
            year,
            employeeIds: employeeIds.length > 0 ? employeeIds : undefined,
          });
          return { sent: result.sent, failed: result.failed };
        }}
        onExport={async () => {
          'use server';
          // Export is downloaded via client-side trigger in the component.
          // Server action generates data; client initiates download.
          await exportDocuments({ year, format: 'csv' });
        }}
      />
    </div>
  );
}
