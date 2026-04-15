import Link from 'next/link';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PayrollRecordWithEmployee } from '@/app/(dashboard)/payroll/queries';

interface ExceptionReportProps {
  records: PayrollRecordWithEmployee[];
  periodId: string;
}

function fullName(emp: PayrollRecordWithEmployee['employee']): string {
  const parts = [emp.lastName, emp.firstName];
  if (emp.middleName) parts[1] = `${emp.firstName} ${emp.middleName.charAt(0)}.`;
  return parts.join(', ');
}

function getExceptionSeverity(record: PayrollRecordWithEmployee): 'high' | 'medium' {
  const net = parseFloat(record.netPay);
  if (net < 0) return 'high';
  return 'medium';
}

export function ExceptionReport({ records, periodId }: ExceptionReportProps) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-10 text-center">
        <AlertTriangle className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No exceptions found</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          All records computed without issues.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-sm text-amber-800">
          <strong>{records.length} record{records.length !== 1 ? 's' : ''}</strong>{' '}
          require attention before approval. Review and resolve each exception below.
        </p>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Net Pay</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead className="w-20">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => {
              const severity = getExceptionSeverity(record);
              return (
                <TableRow key={record.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{fullName(record.employee)}</span>
                      <span className="text-xs text-muted-foreground">
                        {record.employee.employeeNo}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {record.employee.officeName ?? '—'}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`font-mono text-sm ${
                        parseFloat(record.netPay) < 0
                          ? 'text-red-600 font-semibold'
                          : ''
                      }`}
                    >
                      ₱{parseFloat(record.netPay).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      {severity === 'high' ? (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      )}
                      <p className="text-sm text-foreground">
                        {record.exceptionNotes ?? 'Unknown exception'}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/payroll/${periodId}/records/${record.id}`}
                      className="text-sm text-[#0B2545] hover:underline"
                    >
                      Review
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
