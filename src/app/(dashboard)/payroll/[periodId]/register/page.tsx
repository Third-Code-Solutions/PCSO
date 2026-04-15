'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Download, ArrowLeft, FileBarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { PayrollRegisterDocument } from '@/components/pdf/payroll-register';
import type { PayrollPeriod } from '@/lib/db/schema';
import type { PayrollRecordWithEmployee } from '@/app/(dashboard)/payroll/queries';

/**
 * Payroll Register page — server-fetches data then renders client PDF download.
 * Data is passed via URL or prefetched; for simplicity we use a client approach
 * with an API endpoint pattern here. The real implementation would use RSC with
 * a client PDF boundary.
 */
export default function RegisterPage() {
  const params = useParams<{ periodId: string }>();
  const { periodId } = params;

  // In production: fetch period + records from the server
  // Here we provide a download link that generates the PDF client-side

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <li>
                <Link href="/payroll" className="hover:text-foreground">
                  Payroll
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href={`/payroll/${periodId}`} className="hover:text-foreground">
                  Period
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="font-medium text-foreground">Payroll Register</li>
            </ol>
          </nav>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-[#0B2545]">
            <FileBarChart className="h-6 w-6" />
            Payroll Register
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Summary of all employee records for this payroll period.
          </p>
        </div>

        <Button variant="outline" size="sm" asChild>
          <Link href={`/payroll/${periodId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Period
          </Link>
        </Button>
      </div>

      <Card className="border-[#0B2545]/10">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <FileBarChart className="mb-4 h-16 w-16 text-[#0B2545]/30" />
          <h2 className="text-lg font-semibold text-[#0B2545]">Download Payroll Register</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            The payroll register is a comprehensive summary of all employee payroll records
            for this period, formatted for COA audit submission.
          </p>

          <div className="mt-6 flex items-center gap-3">
            {/*
              PDF generation requires the data to be passed from parent.
              The RegisterDownloadButton below handles the client-side PDF render.
              In RSC pattern, wrap PayrollRegisterDocument in a Suspense boundary.
            */}
            <RegisterDownloadButton periodId={periodId} />
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            PDF is generated in your browser using current period data.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

/**
 * Client component that lazy-loads PDF data and triggers download.
 * Real implementation would use a Server Action to fetch records.
 */
function RegisterDownloadButton({ periodId }: { periodId: string }) {
  const [data, setData] = React.useState<{
    period: PayrollPeriod;
    records: PayrollRecordWithEmployee[];
  } | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/${periodId}/register-data`);
      if (!res.ok) throw new Error('Failed to fetch register data');
      const json = await res.json() as { period: PayrollPeriod; records: PayrollRecordWithEmployee[] };
      setData(json);
    } catch {
      setLoading(false);
    }
  }

  if (!data) {
    return (
      <Button
        size="sm"
        className="bg-[#0B2545] text-white hover:bg-[#13315C]"
        onClick={loadData}
        disabled={loading}
      >
        <Download className="mr-2 h-4 w-4" />
        {loading ? 'Loading...' : 'Generate PDF'}
      </Button>
    );
  }

  return (
    <PDFDownloadLink
      document={
        <PayrollRegisterDocument
          period={data.period}
          records={data.records}
          generatedAt={new Date().toISOString()}
        />
      }
      fileName={`payroll-register-${data.period.name.toLowerCase().replace(/\s+/g, '-')}.pdf`}
    >
      {({ loading: pdfLoading }) => (
        <Button
          size="sm"
          className="bg-[#0B2545] text-white hover:bg-[#13315C]"
          disabled={pdfLoading}
        >
          <Download className="mr-2 h-4 w-4" />
          {pdfLoading ? 'Generating...' : 'Download PDF'}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
