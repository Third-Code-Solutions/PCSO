"use client";

/**
 * LeaveCardDownloader — client-only CSV download button.
 *
 * Generates a CSC Form 6 (Individual Leave Record) CSV on demand and triggers
 * a browser download. CSV is used instead of PDF because @react-pdf/renderer
 * has known incompatibilities with React 19 in this app.
 */

import { useState, useTransition } from "react";
import {
  generateLeaveCardCSV,
  leaveCardFilename,
  type LeaveCardProps,
} from "@/components/leave/leave-card";

interface LeaveCardDownloaderProps {
  leaveCardProps: LeaveCardProps;
}

export function LeaveCardDownloader({
  leaveCardProps,
}: LeaveCardDownloaderProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    startTransition(() => {
      try {
        const csv = generateLeaveCardCSV(leaveCardProps);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = leaveCardFilename(leaveCardProps);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Revoke the object URL after a tick to avoid interrupting the download
        // on some older Safari builds.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to generate CSV.";
        setError(message);
      }
    });
  };

  if (error) {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={error}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 text-sm font-medium text-red-700 hover:bg-red-100"
      >
        Retry CSV download
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-busy={isPending}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-pcso-navy bg-pcso-navy px-4 text-sm font-semibold text-pcso-cream shadow-sm transition-colors hover:bg-pcso-navy-light disabled:opacity-60"
    >
      {isPending ? (
        <>
          <span
            aria-hidden
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-pcso-cream border-t-transparent"
          />
          Building CSV…
        </>
      ) : (
        <>
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download Leave Card (Form 6 CSV)
        </>
      )}
    </button>
  );
}
