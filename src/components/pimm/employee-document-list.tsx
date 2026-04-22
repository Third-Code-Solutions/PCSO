"use client";

import { useState } from "react";
import {
  approveDocument,
  rejectDocument,
} from "@/lib/actions/pimm/employee-documents";
import type { DocumentRow } from "@/lib/actions/pimm/employee-documents";

interface EmployeeDocumentListProps {
  documents: DocumentRow[];
  employeeId: string;
}

export function EmployeeDocumentList({
  documents,
  employeeId,
}: EmployeeDocumentListProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(documentId: string) {
    setProcessingId(documentId);
    setError(null);

    const result = await approveDocument({ documentId });

    if ("error" in result) {
      setError(result.error);
    }

    setProcessingId(null);
  }

  async function handleReject(documentId: string) {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;

    setProcessingId(documentId);
    setError(null);

    const result = await rejectDocument({ documentId, reason });

    if ("error" in result) {
      setError(result.error);
    }

    setProcessingId(null);
  }

  const staging = documents.filter((d) => d.status === "staging");
  const approved = documents.filter((d) => d.status === "approved");
  const rejected = documents.filter((d) => d.status === "rejected");

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Staging Documents */}
      {staging.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Pending Approval (Staging)
          </h3>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {staging.map((doc) => (
                <li key={doc.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-indigo-600 truncate">
                          {doc.fileName}
                        </p>
                        <p className="text-sm text-gray-500">
                          Type: {doc.documentTypeCode} • Uploaded by{" "}
                          {doc.uploadedByName} on{" "}
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          View
                        </a>
                        <button
                          onClick={() => handleApprove(doc.id)}
                          disabled={processingId === doc.id}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(doc.id)}
                          disabled={processingId === doc.id}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Approved Documents */}
      {approved.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Approved Documents
          </h3>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {approved.map((doc) => (
                <li key={doc.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-indigo-600 truncate">
                          {doc.fileName}
                        </p>
                        <p className="text-sm text-gray-500">
                          Type: {doc.documentTypeCode} • Approved by{" "}
                          {doc.approvedByName} on{" "}
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        View
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Rejected Documents */}
      {rejected.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Rejected Documents
          </h3>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {rejected.map((doc) => (
                <li key={doc.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-600 truncate">
                          {doc.fileName}
                        </p>
                        <p className="text-sm text-gray-500">
                          Type: {doc.documentTypeCode}
                        </p>
                        {doc.rejectionReason && (
                          <p className="text-sm text-red-600 mt-1">
                            Reason: {doc.rejectionReason}
                          </p>
                        )}
                      </div>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        View
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {documents.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">No documents uploaded yet.</p>
        </div>
      )}
    </div>
  );
}
