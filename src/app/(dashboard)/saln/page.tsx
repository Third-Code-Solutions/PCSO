/**
 * /saln — My SALN Submissions
 *
 * Lists the current user's SALN filings. Only shows the authenticated
 * employee's own records. Redirects to /login if unauthenticated.
 *
 * Access: employee_self_service (own records only), super_admin (all).
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PlusIcon, FileTextIcon } from 'lucide-react';
import { requirePermission } from '@/lib/auth/guards';
import { getMySalnSubmissions } from '@/app/(dashboard)/saln/queries';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { annualDeadline, daysUntilDeadline } from '@/lib/utils/saln/deadline';
import { formatPeso } from '@/lib/utils/saln/net-worth';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import type { SalnStatus } from '@/lib/validations/saln';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: SalnStatus) {
  type BadgeVariant = 'secondary' | 'outline' | 'destructive';

  const variants: Record<SalnStatus, BadgeVariant> = {
    draft: 'secondary',
    submitted: 'outline',
    received: 'outline',
    verified: 'outline',
    deficient: 'destructive',
  };

  const labels: Record<SalnStatus, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    received: 'Received',
    verified: 'Verified',
    deficient: 'Deficient',
  };

  return (
    <Badge variant={variants[status]} className="capitalize">
      {labels[status]}
    </Badge>
  );
}

function filingTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    annual: 'Annual',
    initial: 'Initial',
    upon_assumption: 'Upon Assumption',
    upon_separation: 'Upon Separation',
  };
  return labels[type] ?? type;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MySalnPage() {
  const user = await requirePermission('saln', 'view');

  if (!user.employeeId) {
    // System-only accounts without an employee record cannot file SALNs.
    redirect('/dashboard');
  }

  // employeeId is guaranteed non-null here (redirect above handles null case).
  const submissions = await getMySalnSubmissions(user.id, user.employeeId as string);

  const currentYear = new Date().getFullYear();
  const coverageYear = currentYear - 1; // Annual SALN covers prior calendar year
  const deadline = annualDeadline(coverageYear);
  const daysLeft = daysUntilDeadline(coverageYear, new Date());

  const hasFiledCurrentYear = submissions.some(
    (s) => s.year === coverageYear && s.filingType === 'annual' && s.status !== 'draft',
  );

  return (
    <div>
      <RealtimeBoundary tables={['saln_submissions']} />
      <PageHeader
        title="My SALN"
        description="Statement of Assets, Liabilities, and Net Worth"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'My SALN' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/saln/submissions">View All</Link>
            </Button>
            <Button asChild className="bg-senate-navy text-white hover:bg-senate-navy-light">
              <Link href="/saln/new">
                <PlusIcon className="mr-2 h-4 w-4" aria-hidden />
                File New SALN
              </Link>
            </Button>
          </div>
        }
      />

      {/* Deadline notice */}
      {!hasFiledCurrentYear && (
        <div
          role="alert"
          className={`mb-6 flex items-start gap-3 rounded-md border p-4 ${
            daysLeft < 0
              ? 'border-destructive/40 bg-destructive/5'
              : daysLeft <= 14
                ? 'border-orange-400/40 bg-orange-50'
                : 'border-senate-gold/40 bg-senate-cream'
          }`}
        >
          <FileTextIcon
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              daysLeft < 0
                ? 'text-destructive'
                : daysLeft <= 14
                  ? 'text-orange-600'
                  : 'text-senate-navy'
            }`}
            aria-hidden
          />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {daysLeft < 0
                ? `Annual SALN for ${coverageYear} is OVERDUE`
                : `Annual SALN for ${coverageYear} due by ${deadline.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {daysLeft < 0
                ? `Your filing is ${Math.abs(daysLeft)} day(s) past the April 30 deadline. Please file immediately.`
                : `${daysLeft} day(s) remaining. Required under Republic Act No. 6713.`}
            </p>
          </div>
        </div>
      )}

      {/* Submissions table */}
      {submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-16 text-center">
          <FileTextIcon className="mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden />
          <p className="text-sm font-medium text-foreground">No SALN submissions yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            File your first SALN to comply with RA 6713.
          </p>
          <Button asChild className="mt-4 bg-senate-navy text-white hover:bg-senate-navy-light" size="sm">
            <Link href="/saln/new">File Now</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Filing Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date Filed</TableHead>
                <TableHead className="text-right">Net Worth</TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.year}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {filingTypeLabel(s.filingType)}
                  </TableCell>
                  <TableCell>{statusBadge(s.status)}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {s.dateFiled ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatPeso(s.netWorth)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/saln/${s.id}`}
                        className="text-xs text-senate-navy underline hover:no-underline"
                      >
                        View
                      </Link>
                      {s.status === 'draft' && (
                        <Link
                          href={`/saln/${s.id}/edit`}
                          className="text-xs text-muted-foreground underline hover:no-underline"
                        >
                          Edit
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        SALN data is strictly confidential under RA 6713. All access is logged and audited.
      </p>
    </div>
  );
}
