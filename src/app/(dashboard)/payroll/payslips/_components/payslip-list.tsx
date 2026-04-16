'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Download, FileText, ChevronRight, FileDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { MyPayslip } from '@/app/(dashboard)/payroll/queries';

// ─── Dynamic PDF download link (client-only) ─────────────────────────────────
// React-PDF depends on browser APIs (canvas, fonts). We load it lazily so a
// missing runtime dependency doesn't crash the list — if this chunk fails, the
// card still renders with the CSV fallback button available.

const PayslipPdfDownload = dynamic(
  () =>
    import('./payslip-pdf-download').then((m) => ({ default: m.PayslipPdfDownload })),
  {
    ssr: false,
    loading: () => (
      <Button
        size="sm"
        variant="outline"
        disabled
        className="border-[#0B2545] text-[#0B2545]"
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        PDF
      </Button>
    ),
  },
);

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
  return `₱${num.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function escapeCsv(value: string): string {
  // Minimal RFC 4180 escaping.
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function payslipToCsv(item: MyPayslip): string {
  const { record, period, employee } = item;
  const fullName = [employee.lastName, employee.firstName, employee.middleName]
    .filter(Boolean)
    .join(', ');

  const rows: Array<[string, string | null | undefined] | null> = [
    ['Pay Period', period.name],
    ['Period Start', period.periodStart],
    ['Period End', period.periodEnd],
    ['Pay Date', period.payDate],
    ['Employee No.', employee.employeeNo],
    ['Employee Name', fullName],
    ['Position', employee.positionTitle],
    ['Office', employee.officeName ?? ''],
    ['Salary Grade / Step', `SG ${employee.salaryGrade} / Step ${employee.step}`],
    null,
    ['Earnings', ''],
    ['Basic Pay', record.basicPay],
    ['RATA', record.rata],
    ['Longevity Pay', record.longevityPay],
    ['Overtime Pay', record.overtimePay],
    ['PERA', record.pera],
    ['Other Earnings', record.otherEarnings],
    ['Gross Pay', record.grossPay],
    null,
    ['Deductions', ''],
    ['GSIS Personal', record.gsisPersonal],
    ['PhilHealth Personal', record.philhealthPersonal],
    ['Pag-IBIG Personal', record.pagibigPersonal],
    ['Withholding Tax', record.withholdingTax],
    ['Late Deduction', record.lateDeduction],
    ['Undertime Deduction', record.undertimeDeduction],
    ['Absence Deduction', record.absenceDeduction],
    ['Other Deductions', record.otherDeductions],
    ['Total Deductions', record.totalDeductions],
    null,
    ['Net Pay', record.netPay],
  ];

  return rows
    .map((r) => (r === null ? '' : `${escapeCsv(r[0])},${escapeCsv(String(r[1] ?? ''))}`))
    .join('\r\n');
}

function downloadCsv(item: MyPayslip) {
  const csv = payslipToCsv(item);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payslip-${item.period.name.toLowerCase().replace(/\s+/g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── PayslipCard ──────────────────────────────────────────────────────────────

function PayslipCard({ item }: { item: MyPayslip }) {
  const { record, period } = item;
  const [expanded, setExpanded] = React.useState(false);

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-[#0B2545]">{period.name}</span>
            <Badge
              variant="outline"
              className="border-[#C8A84B] bg-[#C8A84B] text-xs text-white"
            >
              Paid
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDate(period.periodStart)} – {formatDate(period.periodEnd)} · Pay Date:{' '}
            {formatDate(period.payDate)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Net Pay</p>
            <p className="font-mono font-bold text-[#0B2545]">{formatPeso(record.netPay)}</p>
          </div>

          <PayslipPdfDownload item={item} />

          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadCsv(item)}
            className="border-[#0B2545] text-[#0B2545] hover:bg-[#0B2545] hover:text-white"
            aria-label={`Download CSV for ${period.name}`}
          >
            <FileDown className="mr-1.5 h-3.5 w-3.5" />
            CSV
          </Button>

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
                <p
                  className={`mt-0.5 font-mono text-sm ${
                    bold ? 'font-bold text-[#0B2545]' : ''
                  }`}
                >
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

// ─── PayslipList ──────────────────────────────────────────────────────────────

interface PayslipListProps {
  payslips: MyPayslip[];
}

export function PayslipList({ payslips }: PayslipListProps) {
  return (
    <div className="space-y-3">
      {payslips.map((item) => (
        <PayslipCard key={item.record.id} item={item} />
      ))}
    </div>
  );
}
