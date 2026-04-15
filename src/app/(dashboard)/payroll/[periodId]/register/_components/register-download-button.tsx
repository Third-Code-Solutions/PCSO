'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { PayrollRegisterDocument } from '@/components/pdf/payroll-register';
import type { PayrollPeriod } from '@/lib/db/schema';
import type { PayrollRecordWithEmployee } from '@/app/(dashboard)/payroll/queries';

interface RegisterDownloadButtonProps {
  period: PayrollPeriod;
  records: PayrollRecordWithEmployee[];
}

export function RegisterDownloadButton({ period, records }: RegisterDownloadButtonProps) {
  const fileName = `payroll-register-${period.name.toLowerCase().replace(/\s+/g, '-')}.pdf`;

  return (
    <PDFDownloadLink
      document={
        <PayrollRegisterDocument
          period={period}
          records={records}
          generatedAt={new Date().toISOString()}
        />
      }
      fileName={fileName}
    >
      {({ loading }) => (
        <Button
          size="sm"
          className="bg-[#0B2545] text-white hover:bg-[#13315C]"
          disabled={loading}
        >
          <Download className="mr-2 h-4 w-4" />
          {loading ? 'Generating...' : 'Download PDF'}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
