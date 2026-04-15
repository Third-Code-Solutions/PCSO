import { Separator } from '@/components/ui/separator';
import type { PayrollRecord } from '@/lib/db/schema';

interface RecordBreakdownProps {
  record: PayrollRecord;
}

function formatPeso(value: string | null | undefined): string {
  if (!value) return '₱0.00';
  const num = parseFloat(value);
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface LineItemProps {
  label: string;
  value: string | null | undefined;
  isTotal?: boolean;
  isSub?: boolean;
  isNegative?: boolean;
}

function LineItem({ label, value, isTotal, isSub, isNegative }: LineItemProps) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${
        isTotal ? 'font-semibold' : ''
      } ${isSub ? 'pl-4 text-sm text-muted-foreground' : ''}`}
    >
      <span>{label}</span>
      <span
        className={`font-mono ${isNegative ? 'text-red-600' : ''} ${
          isTotal ? 'text-base' : 'text-sm'
        }`}
      >
        {isNegative ? `(${formatPeso(value)})` : formatPeso(value)}
      </span>
    </div>
  );
}

export function RecordBreakdown({ record }: RecordBreakdownProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ── Earnings ──────────────────────────────────────────────── */}
      <section aria-labelledby="earnings-heading">
        <h3
          id="earnings-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#0B2545]"
        >
          Earnings
        </h3>
        <div className="rounded-lg border border-border bg-card p-4">
          <LineItem label="Authorized Salary" value={record.authorizedSalary} isSub />
          <LineItem label="Basic Pay" value={record.basicPay} />
          <LineItem label="RATA (Rep. & Transportation)" value={record.rata} />
          <LineItem label="Longevity Pay" value={record.longevityPay} />
          <LineItem label="Overtime Pay" value={record.overtimePay} />
          <LineItem label="PERA" value={record.pera} />
          <LineItem label="Other Earnings" value={record.otherEarnings} />
          <Separator className="my-2" />
          <LineItem label="GROSS PAY" value={record.grossPay} isTotal />
        </div>
      </section>

      {/* ── Deductions ────────────────────────────────────────────── */}
      <section aria-labelledby="deductions-heading">
        <h3
          id="deductions-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#0B2545]"
        >
          Deductions
        </h3>
        <div className="rounded-lg border border-border bg-card p-4">
          <LineItem label="GSIS (Personal)" value={record.gsisPersonal} isNegative />
          <LineItem label="GSIS Life Insurance" value={record.gsisLifeInsurance} isNegative />
          <LineItem label="PhilHealth (Personal)" value={record.philhealthPersonal} isNegative />
          <LineItem label="Pag-IBIG (Personal)" value={record.pagibigPersonal} isNegative />
          <Separator className="my-1" />
          <LineItem label="Withholding Tax" value={record.withholdingTax} isNegative />
          <Separator className="my-1" />
          <LineItem label="Late Deduction" value={record.lateDeduction} isNegative />
          <LineItem label="Undertime Deduction" value={record.undertimeDeduction} isNegative />
          <LineItem label="Absence Deduction" value={record.absenceDeduction} isNegative />
          <LineItem label="Other Deductions" value={record.otherDeductions} isNegative />
          <Separator className="my-2" />
          <LineItem label="TOTAL DEDUCTIONS" value={record.totalDeductions} isTotal isNegative />
        </div>
      </section>

      {/* ── Net Pay ───────────────────────────────────────────────── */}
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between rounded-xl border-2 border-[#C8A84B] bg-[#FAF4E6] p-5">
          <span className="text-xl font-bold text-[#0B2545]">NET PAY</span>
          <span className="text-2xl font-bold tracking-tight text-[#0B2545]">
            {formatPeso(record.netPay)}
          </span>
        </div>
      </div>

      {/* ── Employer Shares (informational) ───────────────────────── */}
      <div className="lg:col-span-2">
        <details className="group">
          <summary className="cursor-pointer select-none text-sm text-muted-foreground hover:text-foreground">
            Employer Shares (not deducted from net pay)
          </summary>
          <div className="mt-2 rounded-lg border border-dashed border-border p-4 text-sm">
            <LineItem label="GSIS (Employer Share)" value={record.gsisEmployer} isSub />
            <LineItem label="PhilHealth (Employer Share)" value={record.philhealthEmployer} isSub />
            <LineItem label="Pag-IBIG (Employer Share)" value={record.pagibigEmployer} isSub />
          </div>
        </details>
      </div>
    </div>
  );
}
