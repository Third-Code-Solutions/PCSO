"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pause } from "lucide-react";
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
import { putDocumentRequestOnHold } from "@/lib/actions/documents";

const holdFormSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters"),
});

interface HoldRequestFormProps {
  requestId: string;
}

export function HoldRequestForm({ requestId }: HoldRequestFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof holdFormSchema>>({
    resolver: zodResolver(holdFormSchema),
    defaultValues: {
      reason: "",
    },
  });

  async function onSubmit(values: z.infer<typeof holdFormSchema>) {
    setIsSubmitting(true);
    try {
      const result = await putDocumentRequestOnHold({
        requestId,
        reason: values.reason,
      });

      if (result.success) {
        toast({
          title: "Request On Hold",
          description: "Document request has been put on hold.",
        });
        router.refresh();
        form.reset();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to put request on hold",
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
        <CardTitle className="text-lg">Put On Hold</CardTitle>
        <CardDescription>
          Temporarily pause processing. Provide a reason for the hold.
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
                  <FormLabel>Reason for Hold</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Missing 201 file documents, awaiting employee clarification..."
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
              variant="outline"
              className="w-full"
            >
              <Pause className="h-4 w-4 mr-2" />
              {isSubmitting ? "Putting On Hold..." : "Put On Hold"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
