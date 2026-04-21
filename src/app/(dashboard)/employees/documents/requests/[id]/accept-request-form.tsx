"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { acceptDocumentRequest } from "@/lib/actions/documents";

interface AcceptRequestFormProps {
  requestId: string;
}

export function AcceptRequestForm({ requestId }: AcceptRequestFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAccept() {
    setIsSubmitting(true);
    try {
      const result = await acceptDocumentRequest({ requestId });

      if (result.success) {
        toast({
          title: "Request Accepted",
          description: "Document request is now in process.",
        });
        router.refresh();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to accept request",
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
        <CardTitle className="text-lg">Accept Request</CardTitle>
        <CardDescription>
          Begin processing this document request. You will be assigned as the
          processor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleAccept}
          disabled={isSubmitting}
          className="w-full"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {isSubmitting ? "Accepting..." : "Accept & Start Processing"}
        </Button>
      </CardContent>
    </Card>
  );
}
