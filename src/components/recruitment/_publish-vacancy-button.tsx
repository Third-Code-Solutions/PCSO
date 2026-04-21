"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

interface PublishVacancyButtonClientProps {
  mrfId: string;
  publishAction: (
    mrfId: string,
  ) => Promise<ActionResult<{ vacancyId: string }>>;
}

export function PublishVacancyButtonClient({
  mrfId,
  publishAction,
}: PublishVacancyButtonClientProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onClick() {
    setPending(true);
    try {
      const result = await publishAction(mrfId);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success("Vacancy published.");
        router.push(`/recruitment/vacancies/${result.data.vacancyId}`);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" onClick={onClick} disabled={pending}>
      {pending ? "Publishing…" : "Publish Vacancy"}
    </Button>
  );
}

export default PublishVacancyButtonClient;
