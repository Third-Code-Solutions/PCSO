'use client';

import { useState, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { Upload, File, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EmployeeDocumentsInput } from '@/lib/validations/employees';

type DocumentType = '201_file' | 'appointment_paper' | 'medical_certificate' | 'other';

const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: '201_file', label: '201 File' },
  { value: 'appointment_paper', label: 'Appointment Paper' },
  { value: 'medical_certificate', label: 'Medical Certificate' },
  { value: 'other', label: 'Other' },
];

type PendingDocument = {
  tempId: string;
  file: File;
  docType: DocumentType;
  status: 'pending' | 'uploading' | 'done' | 'error';
  storagePath?: string;
  errorMsg?: string;
};

interface EmployeeFormDocumentsProps {
  employeeId?: string; // present on edit; absent on create (upload deferred)
  onUpload?: (
    fileName: string,
    fileBase64: string,
    mimeType: string,
  ) => Promise<{ storagePath: string; publicUrl: string }>;
}

export function EmployeeFormDocuments({
  employeeId: _employeeId,
  onUpload,
}: EmployeeFormDocumentsProps) {
  const { setValue, watch } = useFormContext<EmployeeDocumentsInput>();
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);
  const [selectedType, setSelectedType] = useState<DocumentType>('201_file');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const savedDocuments = watch('documents') ?? [];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    for (const file of files) {
      const tempId = `${Date.now()}-${Math.random()}`;
      const pending: PendingDocument = {
        tempId,
        file,
        docType: selectedType,
        status: 'pending',
      };

      setPendingDocs((prev) => [...prev, pending]);

      if (onUpload) {
        setPendingDocs((prev) =>
          prev.map((d) => (d.tempId === tempId ? { ...d, status: 'uploading' } : d)),
        );

        try {
          const base64 = await fileToBase64(file);
          const result = await onUpload(file.name, base64, file.type);

          setPendingDocs((prev) =>
            prev.map((d) =>
              d.tempId === tempId ? { ...d, status: 'done', storagePath: result.storagePath } : d,
            ),
          );

          const current = watch('documents') ?? [];
          setValue('documents', [
            ...current,
            {
              name: file.name,
              type: selectedType,
              storagePath: result.storagePath,
              uploadedAt: new Date().toISOString(),
            },
          ]);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed';
          setPendingDocs((prev) =>
            prev.map((d) =>
              d.tempId === tempId ? { ...d, status: 'error', errorMsg: msg } : d,
            ),
          );
        }
      }
    }

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeSavedDoc = (index: number) => {
    const updated = savedDocuments.filter((_, i) => i !== index);
    setValue('documents', updated);
  };

  const removePendingDoc = (tempId: string) => {
    setPendingDocs((prev) => prev.filter((d) => d.tempId !== tempId));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <strong>201 File Management:</strong> Documents are stored securely in Supabase Storage.
        {!onUpload && (
          <span className="block mt-1">
            Save the employee record first before uploading documents.
          </span>
        )}
      </div>

      {/* Upload controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <label htmlFor="docType" className="text-sm font-medium">
            Document Type
          </label>
          <select
            id="docType"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as DocumentType)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {DOCUMENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={!onUpload}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          {onUpload ? 'Upload File' : 'Save employee first'}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          multiple
          onChange={handleFileChange}
        />
      </div>

      {/* Saved documents */}
      {savedDocuments.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Saved Documents</h3>
          <ul className="divide-y divide-border rounded-md border">
            {savedDocuments.map((doc, idx) => (
              <li key={idx} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <File className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.storagePath}</p>
                  </div>
                  <Badge variant="secondary">{doc.type.replace(/_/g, ' ')}</Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSavedDoc(idx)}
                  aria-label={`Remove ${doc.name}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Pending (in-flight) documents */}
      {pendingDocs.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Upload Queue</h3>
          <ul className="divide-y divide-border rounded-md border">
            {pendingDocs.map((doc) => (
              <li key={doc.tempId} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <File className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{doc.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(doc.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  {doc.status === 'uploading' && (
                    <Badge variant="info">Uploading…</Badge>
                  )}
                  {doc.status === 'done' && <Badge variant="success">Done</Badge>}
                  {doc.status === 'error' && (
                    <div className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span className="text-xs">{doc.errorMsg}</span>
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePendingDoc(doc.tempId)}
                  aria-label={`Remove ${doc.file.name}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {savedDocuments.length === 0 && pendingDocs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-10 text-center text-muted-foreground">
          <File className="mb-2 h-8 w-8" />
          <p className="text-sm">No documents uploaded yet.</p>
          <p className="text-xs">
            Accepted formats: PDF, Word, JPG, PNG (max 10 MB per file)
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: convert File to base64 string
// ---------------------------------------------------------------------------
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix: "data:<mime>;base64,"
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to read file as base64'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}
