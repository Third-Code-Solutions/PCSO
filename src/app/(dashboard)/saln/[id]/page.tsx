/**
 * /saln/[id] — View SALN Submission
 *
 * Displays full details of a single SALN submission.
 * Access: employee sees own records; super_admin sees all.
 * Every view of a submitted (non-draft) SALN is audit-logged per SALN security policy.
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { EditIcon, PrinterIcon } from 'lucide-react';
import { requirePermission } from '@/lib/auth/guards';
import { getSalnSubmissionById } from '@/app/(dashboard)/saln/queries';
import { reviewSaln } from '@/app/(dashboard)/saln/admin-actions';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatPeso } from '@/lib/utils/saln/net-worth';
import { SalnReviewPanel } from '@/components/saln/review-panel';
import { PrintOnLoad } from '@/components/saln/print-on-load';
import type {
  RealAsset,
  PersonalProperty,
  Investment,
  Liability,
  BusinessInterest,
  RelativeInGovernment,
  SalnStatus,
} from '@/lib/validations/saln';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: SalnStatus) {
  type BadgeVariant = 'secondary' | 'outline' | 'destructive';

  function getBadgeConfig(s: SalnStatus): { label: string; variant: BadgeVariant } {
    switch (s) {
      case 'draft': return { label: 'Draft', variant: 'secondary' };
      case 'submitted': return { label: 'Submitted', variant: 'outline' };
      case 'received': return { label: 'Received', variant: 'outline' };
      case 'verified': return { label: 'Verified', variant: 'outline' };
      case 'deficient': return { label: 'Deficient', variant: 'destructive' };
      default: return { label: String(s), variant: 'secondary' };
    }
  }

  const { label, variant } = getBadgeConfig(status);
  return <Badge variant={variant}>{label}</Badge>;
}

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

function RealAssetsSection({ items }: { items: RealAsset[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">None declared.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border border-border bg-muted/20 p-3 text-sm">
          <p className="font-medium">{item.description}</p>
          <p className="text-muted-foreground">
            {item.kind} — {item.location}
          </p>
          <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
            <span>Year Acquired: {item.yearAcquired}</span>
            <span>Mode: {item.mode}</span>
            <span>Cost: {formatPeso(item.cost)}</span>
            <span>Assessed Value: {formatPeso(item.assessedValue)}</span>
            <span>Market Value: {formatPeso(item.marketValue)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PersonalPropertiesSection({ items }: { items: PersonalProperty[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">None declared.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border border-border bg-muted/20 p-3 text-sm">
          <p className="font-medium">{item.description}</p>
          <div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
            <span>Year Acquired: {item.yearAcquired}</span>
            <span>Cost: {formatPeso(item.cost)}</span>
            <span>Market Value: {formatPeso(item.currentFairMarketValue)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function InvestmentsSection({ items }: { items: Investment[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">None declared.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border border-border bg-muted/20 p-3 text-sm">
          <p className="font-medium">{item.institution}</p>
          <p className="text-muted-foreground">{item.type} ({item.year})</p>
          <p className="mt-1 text-xs font-semibold">{formatPeso(item.amount)}</p>
        </div>
      ))}
    </div>
  );
}

function LiabilitiesSection({ items }: { items: Liability[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">None declared.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border border-border bg-muted/20 p-3 text-sm">
          <p className="font-medium">{item.nature}</p>
          <p className="text-muted-foreground">Creditor: {item.creditor}</p>
          <p className="mt-1 text-xs font-semibold text-destructive">
            Balance: {formatPeso(item.outstandingBalance)}
          </p>
        </div>
      ))}
    </div>
  );
}

function BusinessInterestsSection({ items }: { items: BusinessInterest[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">None declared.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border border-border bg-muted/20 p-3 text-sm">
          <p className="font-medium">{item.entityName}</p>
          <p className="text-muted-foreground">
            {item.nature} — {item.businessAddress}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Date Acquired: {item.dateAcquired}
          </p>
        </div>
      ))}
    </div>
  );
}

function RelativesSection({ items }: { items: RelativeInGovernment[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">None declared.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border border-border bg-muted/20 p-3 text-sm">
          <p className="font-medium">{item.name}</p>
          <p className="text-muted-foreground">
            {item.relationship} — {item.position}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{item.agencyAddress}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface SalnDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}

export default async function SalnDetailPage({
  params,
  searchParams,
}: SalnDetailPageProps) {
  const user = await requirePermission('saln', 'view');
  const { id } = await params;
  const { print } = await searchParams;
  const shouldPrintOnLoad = print === '1';

  let submission: Awaited<ReturnType<typeof getSalnSubmissionById>> | null = null;
  try {
    submission = await getSalnSubmissionById(
      user.id,
      user.employeeId,
      id,
      user.role === 'super_admin',
    );
  } catch (err) {
    if (
      err instanceof Error &&
      'status' in err &&
      (err as Error & { status: number }).status === 403
    ) {
      redirect('/saln');
    }
    throw err;
  }

  if (!submission) notFound();
  // Use non-null assertion — notFound() throws so we never reach the lines below.
  const sub = submission!;

  // Matches editableStatuses in [id]/edit/page.tsx — drafts and deficient submissions
  // can be edited by the owning employee or super_admin.
  const canEdit =
    (sub.status === 'draft' || sub.status === 'deficient') &&
    (user.role === 'super_admin' || user.employeeId === sub.employeeId);

  const isSuperAdmin = user.role === 'super_admin';

  return (
    <div>
      {shouldPrintOnLoad && <PrintOnLoad />}
      <PageHeader
        title={`SALN — ${sub.year}`}
        description={`${sub.employeeName} · Filed: ${sub.dateFiled ?? 'Draft'}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'My SALN', href: '/saln' },
          { label: `SALN ${sub.year}` },
        ]}
        actions={
          <div className="flex items-center gap-2 print:hidden">
            {canEdit && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/saln/${sub.id}/edit`}>
                  <EditIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Edit
                </Link>
              </Button>
            )}
            {sub.status !== 'draft' && (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/saln/${sub.id}?print=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <PrinterIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Print / PDF
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {/* Status bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-4">
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          {statusBadge(sub.status)}
        </div>
        <Separator orientation="vertical" className="h-8" />
        <div>
          <p className="text-xs text-muted-foreground">Filing Type</p>
          <p className="text-sm font-medium capitalize">
            {sub.filingType.replace('_', ' ')}
          </p>
        </div>
        <Separator orientation="vertical" className="h-8" />
        <div>
          <p className="text-xs text-muted-foreground">Net Worth</p>
          <p className="text-sm font-mono font-semibold text-senate-navy">
            {formatPeso(sub.netWorth)}
          </p>
        </div>
        <Separator orientation="vertical" className="h-8" />
        <div>
          <p className="text-xs text-muted-foreground">Total Assets</p>
          <p className="text-sm font-mono">{formatPeso(sub.totalAssets)}</p>
        </div>
        <Separator orientation="vertical" className="h-8" />
        <div>
          <p className="text-xs text-muted-foreground">Total Liabilities</p>
          <p className="text-sm font-mono text-destructive">
            {formatPeso(sub.totalLiabilities)}
          </p>
        </div>
      </div>

      {/* SALN sections */}
      <div className="space-y-8">
        <section aria-labelledby="real-assets-view">
          <h2 id="real-assets-view" className="mb-3 text-base font-semibold text-senate-navy">
            A. Real Properties
          </h2>
          <RealAssetsSection items={sub.realAssets as RealAsset[]} />
        </section>

        <Separator />

        <section aria-labelledby="personal-props-view">
          <h2 id="personal-props-view" className="mb-3 text-base font-semibold text-senate-navy">
            B. Personal Properties
          </h2>
          <PersonalPropertiesSection items={sub.personalProperties as PersonalProperty[]} />
        </section>

        <Separator />

        <section aria-labelledby="investments-view">
          <h2 id="investments-view" className="mb-3 text-base font-semibold text-senate-navy">
            C. Investments / Financial Assets
          </h2>
          <InvestmentsSection items={sub.investments as Investment[]} />
        </section>

        <Separator />

        <section aria-labelledby="liabilities-view">
          <h2 id="liabilities-view" className="mb-3 text-base font-semibold text-senate-navy">
            D. Liabilities
          </h2>
          <LiabilitiesSection items={sub.liabilities as Liability[]} />
        </section>

        <Separator />

        <section aria-labelledby="business-view">
          <h2 id="business-view" className="mb-3 text-base font-semibold text-senate-navy">
            E. Business Interests and Financial Connections
          </h2>
          <BusinessInterestsSection items={sub.businessInterests as BusinessInterest[]} />
        </section>

        <Separator />

        <section aria-labelledby="relatives-view">
          <h2 id="relatives-view" className="mb-3 text-base font-semibold text-senate-navy">
            F. Relatives in Government Service
          </h2>
          <RelativesSection items={sub.relatives as RelativeInGovernment[]} />
        </section>
      </div>

      {sub.remarks && (
        <div className="mt-8 rounded-md border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-800">HR Remarks</p>
          <p className="mt-1 text-sm text-orange-700">{sub.remarks}</p>
        </div>
      )}

      {isSuperAdmin && (
        <div className="mt-8 print:hidden">
          <SalnReviewPanel
            submissionId={sub.id}
            currentStatus={sub.status}
            currentRemarks={sub.remarks}
            onReview={async (input) => {
              'use server';
              return reviewSaln(input);
            }}
          />
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        This SALN is filed pursuant to Republic Act No. 6713. All access to this
        record is logged and audited. Submitted: {sub.createdAt.slice(0, 10)}.
      </p>
    </div>
  );
}
