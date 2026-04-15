'use client';

import { useState } from 'react';
import { File, Download, ExternalLink, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

export type StoredDocument = {
  name: string;
  type: '201_file' | 'appointment_paper' | 'medical_certificate' | 'other';
  storagePath: string;
  uploadedAt?: string;
  signedUrl?: string; // pre-fetched signed URL from the server
};

interface TwoOhOneViewerProps {
  documents: StoredDocument[];
  onRequestSignedUrl?: (storagePath: string) => Promise<string>;
  className?: string;
}

const DOC_TYPE_LABELS: Record<StoredDocument['type'], string> = {
  '201_file': '201 File',
  appointment_paper: 'Appointment Paper',
  medical_certificate: 'Medical Certificate',
  other: 'Other',
};

function DocumentRow({
  doc,
  onRequestUrl,
}: {
  doc: StoredDocument;
  onRequestUrl?: (path: string) => Promise<string>;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(doc.signedUrl ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPdfExpanded, setIsPdfExpanded] = useState(false);

  const isPdf = doc.name.toLowerCase().endsWith('.pdf');

  const loadUrl = async () => {
    if (signedUrl) return signedUrl;
    if (!onRequestUrl) return null;
    setIsLoading(true);
    try {
      const url = await onRequestUrl(doc.storagePath);
      setSignedUrl(url);
      return url;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    const url = await loadUrl();
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleTogglePdf = async () => {
    if (!isPdfExpanded) {
      await loadUrl();
    }
    setIsPdfExpanded((v) => !v);
  };

  const uploadedDate = doc.uploadedAt
    ? new Date(doc.uploadedAt).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <li className="border-b last:border-b-0">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <File className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{doc.name}</p>
            {uploadedDate && (
              <p className="text-xs text-muted-foreground">Uploaded {uploadedDate}</p>
            )}
          </div>
          <Badge variant="secondary" className="shrink-0">
            {DOC_TYPE_LABELS[doc.type]}
          </Badge>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

          {isPdf && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleTogglePdf}
              className="gap-1"
              aria-label={isPdfExpanded ? 'Collapse PDF preview' : 'Expand PDF preview'}
            >
              {isPdfExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Preview
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            aria-label={`Download ${doc.name}`}
          >
            {signedUrl ? (
              <ExternalLink className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Inline PDF preview via <iframe> — Supabase signed URL + CSP nonce handled by Next.js */}
      {isPdf && isPdfExpanded && signedUrl && (
        <div className="border-t bg-muted/30 px-4 py-3">
          <iframe
            src={signedUrl}
            title={`PDF preview: ${doc.name}`}
            className="h-[600px] w-full rounded border bg-white"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      )}
    </li>
  );
}

export function TwoOhOneViewer({
  documents,
  onRequestSignedUrl,
  className,
}: TwoOhOneViewerProps) {
  if (documents.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-muted-foreground',
          className,
        )}
      >
        <File className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm font-medium">No documents on file</p>
        <p className="text-xs">Upload documents from the edit page.</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      <ul className="divide-y divide-border">
        {documents.map((doc, idx) => (
          <DocumentRow key={idx} doc={doc} onRequestUrl={onRequestSignedUrl} />
        ))}
      </ul>
    </div>
  );
}
