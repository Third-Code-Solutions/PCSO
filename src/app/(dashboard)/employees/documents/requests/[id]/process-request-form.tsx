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

interface ProcessRequestFormProps {
  requestId: string;
  documentType: string;
  employeeId: string;
}

export function ProcessRequestForm({
  requestId,
  documentType,
  employeeId,
}: ProcessRequestFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleProcess() {
    setIsSubmitting(true);
    try {
      const result = await processDocumentRequest({
        requestId,
        documentType,
        employeeId,
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
      <CardContent>
        <Button
          onClick={handleProcess}
          disabled={isSubmitting}
          className="w-full"
        >
          <FileCheck className="h-4 w-4 mr-2" />
          {isSubmitting ? "Generating..." : "Generate Document"}
        </Button>
      </CardContent>
    </Card>
  );
}
