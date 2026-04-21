"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { disapproveDocumentRequest } from "@/lib/actions/documents";

const disapproveFormSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters"),
});

interface DisapproveRequestFormProps {
  requestId: string;
}

export function DisapproveRequestForm({
  requestId,
}: DisapproveRequestFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof disapproveFormSchema>>({
    resolver: zodResolver(disapproveFormSchema),
    defaultValues: {
      reason: "",
    },
  });

  async function onSubmit(values: z.infer<typeof disapproveFormSchema>) {
    setIsSubmitting(true);
    try {
      const result = await disapproveDocumentRequest({
        requestId,
        reason: values.reason,
      });

      if (result.success) {
        toast({
          title: "Request Disapproved",
          description: "Document request has been disapproved.",
        });
        router.refresh();
        form.reset();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to disapprove request",
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
        <CardTitle className="text-lg">Disapprove Request</CardTitle>
        <CardDescription>
          Reject this document request. Provide a clear reason.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Disapproval</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Insufficient documentation, request not aligned with policy..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={isSubmitting}
              variant="destructive"
              className="w-full"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {isSubmitting ? "Disapproving..." : "Disapprove Request"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
