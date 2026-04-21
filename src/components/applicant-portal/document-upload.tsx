"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authHeaders } from "@/lib/applicant-portal/session";

export const APPLICANT_DOC_TYPES = [
  "transcript",
  "eligibility_cert",
  "pds",
  "cover_letter",
  "other",
] as const;

export type ApplicantDocType = (typeof APPLICANT_DOC_TYPES)[number];

const DOC_LABEL: Record<ApplicantDocType, string> = {
  transcript: "Transcript of records",
  eligibility_cert: "Eligibility certificate",
  pds: "Personal data sheet (PDS)",
  cover_letter: "Cover letter",
  other: "Other supporting document",
};

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png"]);

interface DocumentUploadProps {
  applicationId: string;
  /** Optional callback invoked after each successful upload. */
  onUploaded?: () => void;
}

interface UploadedDoc {
  id: string;
  fileName: string;
  docType: string;
}

export function DocumentUpload({
  applicationId,
  onUploaded,
}: DocumentUploadProps) {
  const [docType, setDocType] = React.useState<ApplicantDocType>("pds");
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [uploaded, setUploaded] = React.useState<UploadedDoc[]>([]);

  function validate(candidate: File): string | null {
    if (candidate.size <= 0) return "File is empty.";
    if (candidate.size > MAX_BYTES) return "File exceeds 10 MB limit.";
    if (!ALLOWED.has(candidate.type)) {
      return "Only PDF, JPG, or PNG files are allowed.";
    }
    return null;
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    const invalid = validate(file);
    if (invalid) {
      setError(invalid);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docType", docType);

      const res = await fetch(
        `/api/rpm/applications/${applicationId}/documents`,
        {
          method: "POST",
          headers: { ...authHeaders() },
          body: formData,
        },
      );

      if (!res.ok) {
        const problem = (await res.json().catch(() => ({}))) as {
          detail?: string;
        };
        throw new Error(problem.detail ?? `Upload failed (${res.status})`);
      }
      const json = (await res.json()) as {
        data: { id: string; fileName: string; docType: string };
      };
      setUploaded((prev) => [...prev, json.data]);
      setFile(null);
      onUploaded?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleUpload} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="docType">Document type</Label>
          <select
            id="docType"
            value={docType}
            onChange={(e) => setDocType(e.target.value as ApplicantDocType)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {APPLICANT_DOC_TYPES.map((type) => (
              <option key={type} value={type}>
                {DOC_LABEL[type]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="file">File (PDF, JPG, PNG ≤ 10 MB)</Label>
          <input
            id="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#0b1d3a] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#fdf8e9] hover:file:bg-[#0a1830]"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={uploading || !file}>
          {uploading ? "Uploading…" : "Upload document"}
        </Button>
      </form>

      {uploaded.length > 0 && (
        <ul className="space-y-1 text-sm text-[#4b4943]">
          {uploaded.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
              />
              <span>
                {DOC_LABEL[doc.docType as ApplicantDocType] ?? doc.docType} —{" "}
                {doc.fileName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
