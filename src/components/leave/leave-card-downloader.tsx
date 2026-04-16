'use client';

/**
 * LeaveCardDownloader — client-only PDF download button.
 *
 * Uses BlobProvider (render prop) from @react-pdf/renderer so the heavy PDF
 * library never runs on the server. Dynamically imported from _client.tsx
 * via next/dynamic to avoid SSR errors.
 */

import { BlobProvider } from '@react-pdf/renderer';
import { LeaveCard, type LeaveCardProps } from '@/components/leave/leave-card';

interface LeaveCardDownloaderProps {
  leaveCardProps: LeaveCardProps;
}

export function LeaveCardDownloader({ leaveCardProps }: LeaveCardDownloaderProps) {
  const fileName = `LeaveCard_${leaveCardProps.employee.employeeNo}_${leaveCardProps.credits.year}.pdf`;

  return (
    <BlobProvider document={<LeaveCard {...leaveCardProps} />}>
      {({ blob, url, loading, error }) => {
        if (error) {
          return (
            <button
              disabled
              title={error.message}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 text-sm font-medium text-red-700"
            >
              PDF Error
            </button>
          );
        }

        const handleClick = () => {
          if (!blob || !url) return;
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
        };

        return (
          <button
            onClick={handleClick}
            disabled={loading || !blob}
            aria-busy={loading}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-senate-navy bg-senate-navy px-4 text-sm font-semibold text-senate-cream shadow-sm transition-colors hover:bg-senate-navy-light disabled:opacity-60"
          >
            {loading ? (
              <>
                <span
                  aria-hidden
                  className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-senate-cream border-t-transparent"
                />
                Building PDF…
              </>
            ) : (
              <>
                {/* Printer icon (inline SVG, no external dep) */}
                <svg
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print Leave Card (PDF)
              </>
            )}
          </button>
        );
      }}
    </BlobProvider>
  );
}
