'use client';

import * as React from 'react';
import { Download, FileText, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { PayslipDocument } from '@/components/pdf/payslip';
import type { PayrollRecord, PayrollPeriod } from '@/lib/db/schema';

// ─── Type ─────────────────────────────────────────────────────────────────────

interface PayslipSummary {
  record: PayrollRecord;
  period: PayrollPeriod;
  employee: {
    employeeNo: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    positionTitle: string;
    officeName: string | null;
    salaryGrade: number;
    step: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPeso(value: string | null | undefined): string {
  if (!value) return '₱0.00';
  const num = parseFloat(value);
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Components ───────────────────────────────────────────────────────────────

function PayslipCard({ item }: { item: PayslipSummary }) {
  const { record, period, employee } = item;
  const [expanded, setExpanded] = React.useState(false);

  const fileName = `payslip-${period.name.toLowerCase().replace(/\s+/g, '-')}.pdf`;

  return (
    <article className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-[#0B2545]">{period.name}</span>
            <Badge variant="outline" className="text-xs bg-[#C8A84B] text-white border-[#C8A84B]">
              Paid
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDate(period.periodStart)} – {formatDate(period.periodEnd)} · Pay Date: {formatDate(period.payDate)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Net Pay</p>
            <p className="font-mono font-bold text-[#0B2545]">{formatPeso(record.netPay)}</p>
          </div>

          <PDFDownloadLink
            document={
              <PayslipDocument
                record={record}
                period={period}
                employee={employee}
                generatedAt={new Date().toISOString()}
              />
            }
            fileName={fileName}
          >
            {({ loading }) => (
              <Button
                size="sm"
                variant="outline"
                disabled={loading}
                className="border-[#0B2545] text-[#0B2545] hover:bg-[#0B2545] hover:text-white"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {loading ? '...' : 'PDF'}
              </Button>
            )}
          </PDFDownloadLink>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label="Toggle details"
          >
            <ChevronRight
              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/20 px-5 py-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            {[
              { label: 'Gross Pay', value: formatPeso(record.grossPay) },
              { label: 'GSIS', value: formatPeso(record.gsisPersonal) },
              { label: 'PhilHealth', value: formatPeso(record.philhealthPersonal) },
              { label: 'Pag-IBIG', value: formatPeso(record.pagibigPersonal) },
              { label: 'Withholding Tax', value: formatPeso(record.withholdingTax) },
              { label: 'Late Deduction', value: formatPeso(record.lateDeduction) },
              { label: 'Total Deductions', value: formatPeso(record.totalDeductions) },
              { label: 'Net Pay', value: formatPeso(record.netPay), bold: true },
            ].map(({ label, value, bold }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`mt-0.5 font-mono text-sm ${bold ? 'font-bold text-[#0B2545]' : ''}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * My Payslips — employee self-service view.
 * In production: data is fetched server-side via getCurrentUser().employeeId,
 * then getMyPayslips(employeeId). Rendered here as a client shell with
 * placeholder message until API wiring is complete.
 */
export default function MyPayslipsPage() {
  // In production, this is a Server Component fetching:
  //   const user = await requirePermission('payroll', 'view');
  //   const payslips = await getMyPayslips(user.employeeId!);
  //
  // For now, show an informational message.

  const demoItems: PayslipSummary[] = [];

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0B2545]">
            My Payslips
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Download your official payslips for each pay period.
          </p>
        </div>
      </div>

      {demoItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-20 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold">No payslips available</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Your payslips will appear here once payroll has been approved and released
            for your pay period. Contact the Financial Services Department for assistance.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {demoItems.map((item) => (
            <PayslipCard key={item.record.id} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
