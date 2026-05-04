"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface PublishVacancyButtonClientProps {
  vacancyId: string;
  publishAction: (
    vacancyId: string,
  ) => Promise<{ data: { id: string } } | { error: string }>;
}

export function PublishVacancyButtonClient({
  vacancyId,
  publishAction,
}: PublishVacancyButtonClientProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onClick() {
    setPending(true);
    try {
      const result = await publishAction(vacancyId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Vacancy published successfully.");
        router.push(`/recruitment/vacancies/${vacancyId}`);
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
