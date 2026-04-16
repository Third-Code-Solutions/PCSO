'use client';

/**
 * Isolated client component for the React-PDF `PDFDownloadLink`.
 * Loaded via `next/dynamic` so any PDF-only runtime failure stays contained
 * in this chunk and the parent card can still offer the CSV fallback.
 */

import * as React from 'react';
import { Download } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { Button } from '@/components/ui/button';
import { PayslipDocument } from '@/components/pdf/payslip';
import type { MyPayslip } from '@/app/(dashboard)/payroll/queries';

interface PayslipPdfDownloadProps {
  item: MyPayslip;
}

export function PayslipPdfDownload({ item }: PayslipPdfDownloadProps) {
  const { record, period, employee } = item;
  const fileName = `payslip-${period.name.toLowerCase().replace(/\s+/g, '-')}.pdf`;

  return (
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
      {({ loading, error }) => (
        <Button
          size="sm"
          variant="outline"
          disabled={loading || Boolean(error)}
          className="border-[#0B2545] text-[#0B2545] hover:bg-[#0B2545] hover:text-white"
          aria-label={`Download PDF payslip for ${period.name}`}
          title={error ? 'PDF generation unavailable — use CSV' : undefined}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {loading ? '…' : 'PDF'}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
