"use client";

/**
 * PerformanceDocUpload — scanned-document upload control (PMM-005).
 *
 * Storage-agnostic: the parent supplies an `uploadAction` server-action wrapper
 * that persists the file wherever it belongs (performance_ratings for
 * IPCRF/OPCRF, dpcr_forms/bpcr_forms for DPCR/BPCR). This component only handles
 * file selection, validation, base64 encoding, and progress UI.
 */

import * as React from "react";
import { useRouter } from "next/navigation";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png"]);

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface UploadPayload {
  fileName: string;
  fileBase64: string;
  mimeType: string;
}

interface PerformanceDocUploadProps {
  /** Persists the encoded file. Should throw on failure. */
  uploadAction: (payload: UploadPayload) => Promise<void>;
  label?: string;
}

export function PerformanceDocUpload({
  uploadAction,
  label = "Scanned document (PDF/JPG/PNG ≤ 10MB)",
}: PerformanceDocUploadProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  function pick(selected: File | null): void {
    setError(null);
    setDone(false);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!ALLOWED.has(selected.type)) {
      setError("Only PDF, JPG, or PNG files are allowed.");
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError("File exceeds the 10MB limit.");
      return;
    }
    setFile(selected);
  }

  async function submit(): Promise<void> {
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fileBase64 = await fileToBase64(file);
      await uploadAction({
        fileName: file.name,
        fileBase64,
        mimeType: file.type,
      });
      setDone(true);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-pcso-navy file:px-3 file:py-2 file:text-sm file:font-medium file:text-pcso-cream hover:file:bg-pcso-navy-light"
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {done && <p className="text-xs text-emerald-600">Document attached.</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy || !file}
        className="rounded-md bg-pcso-navy px-3 py-1.5 text-xs font-medium text-pcso-cream transition-colors hover:bg-pcso-navy-light disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Upload"}
      </button>
    </div>
  );
}
