import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/layouts/page-header';
import { PayslipList } from './_components/payslip-list';
import { requireAuth } from '@/lib/auth/guards';
import { getMyPayslips } from '../queries';

export const metadata = { title: 'My Payslips' };

// Self-service payslip view — any authenticated user with an employeeId.
// Query scopes to their own records; no admin permission needed.
export default async function MyPayslipsPage() {
  const user = await requireAuth();

  const payslips = user.employeeId
    ? await getMyPayslips(user.employeeId)
    : [];

  return (
    <main className="space-y-6">
      <PageHeader
        title="My Payslips"
        description="Download your official payslips for each pay period."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Payroll', href: '/payroll' },
          { label: 'My Payslips' },
        ]}
      />

      {payslips.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-20 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold">No payslips available</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Your payslips will appear here once payroll has been approved and released
            for your pay period. Contact the Financial Services Department for assistance.
          </p>
        </div>
      ) : (
        <PayslipList payslips={payslips} />
      )}
    </main>
  );
}
