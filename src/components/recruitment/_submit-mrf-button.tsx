"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface SubmitMrfButtonProps {
  mrfId: string;
  submitAction: (input: {
    id: string;
  }) => Promise<
    { data: { id: string; mrfNumber: string } } | { error: string }
  >;
}

export function SubmitMrfButton({ mrfId, submitAction }: SubmitMrfButtonProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleSubmit() {
    setPending(true);
    try {
      const result = await submitAction({ id: mrfId });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`MRF ${result.data.mrfNumber} submitted for approval.`);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button onClick={handleSubmit} disabled={pending}>
      {pending ? "Submitting…" : "Submit for Approval"}
    </Button>
  );
}
