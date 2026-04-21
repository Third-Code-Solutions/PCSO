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
import { releaseDocument } from "@/lib/actions/documents";

interface ReleaseRequestFormProps {
  requestId: string;
}

export function ReleaseRequestForm({ requestId }: ReleaseRequestFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRelease() {
    setIsSubmitting(true);
    try {
      const result = await releaseDocument({ requestId });

      if (result.success) {
        toast({
          title: "Document Released",
          description: "Document has been marked as released to employee.",
        });
        router.refresh();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to release document",
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
        <CardTitle className="text-lg">Release Document</CardTitle>
        <CardDescription>
          Confirm that the document has been released to the employee.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleRelease}
          disabled={isSubmitting}
          className="w-full"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {isSubmitting ? "Releasing..." : "Mark as Released"}
        </Button>
      </CardContent>
    </Card>
  );
}
