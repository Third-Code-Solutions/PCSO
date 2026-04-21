"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { resumeDocumentRequest } from "@/lib/actions/documents";

interface ResumeRequestFormProps {
  requestId: string;
}

export function ResumeRequestForm({ requestId }: ResumeRequestFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleResume() {
    setIsSubmitting(true);
    try {
      const result = await resumeDocumentRequest({ requestId });

      if (result.success) {
        toast({
          title: "Request Resumed",
          description: "Document request is back in process.",
        });
        router.refresh();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to resume request",
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
        <CardTitle className="text-lg">Resume Processing</CardTitle>
        <CardDescription>
          Resume processing this request after resolving the hold reason.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleResume}
          disabled={isSubmitting}
          className="w-full"
        >
          <Play className="h-4 w-4 mr-2" />
          {isSubmitting ? "Resuming..." : "Resume Processing"}
        </Button>
      </CardContent>
    </Card>
  );
}
