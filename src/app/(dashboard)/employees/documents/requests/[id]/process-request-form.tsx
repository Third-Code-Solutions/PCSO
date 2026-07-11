"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { processDocumentRequest } from "@/lib/actions/documents";
import type { CertificateTemplateOption } from "@/lib/actions/documents/certificate-templates";

interface ProcessRequestFormProps {
  requestId: string;
  documentType: string;
  employeeId: string;
  certificateTemplates?: CertificateTemplateOption[];
}

export function ProcessRequestForm({
  requestId,
  documentType,
  employeeId,
  certificateTemplates = [],
}: ProcessRequestFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [templateId, setTemplateId] = useState("");

  const isAdHoc = documentType === "AD_HOC";
  const needsTemplate = isAdHoc && !templateId;

  async function handleProcess() {
    setIsSubmitting(true);
    try {
      const result = await processDocumentRequest({
        requestId,
        documentType,
        employeeId,
        ...(isAdHoc ? { certificateTemplateId: templateId } : {}),
      });

      if (result.success) {
        toast({
          title: "Document Generated",
          description: `Serial Number: ${result.serialNumber}`,
        });
        router.refresh();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to generate document",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Generate Document</CardTitle>
        <CardDescription>
          Generate and sign the requested document. A serial number will be
          assigned.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdHoc && (
          <div className="space-y-1.5">
            <label
              htmlFor="certificate-template"
              className="text-sm font-medium"
            >
              Certificate Template
            </label>
            <select
              id="certificate-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Select a template…</option>
              {certificateTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {certificateTemplates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No active certificate templates are configured.
              </p>
            )}
          </div>
        )}
        <Button
          onClick={handleProcess}
          disabled={isSubmitting || needsTemplate}
          className="w-full"
        >
          <FileCheck className="mr-2 h-4 w-4" />
          {isSubmitting ? "Generating..." : "Generate Document"}
        </Button>
      </CardContent>
    </Card>
  );
}
