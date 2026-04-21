"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ApplicationWizard } from "@/components/applicant-portal/application-wizard";
import { getApplicantToken } from "@/lib/applicant-portal/session";

function NewApplicationBody(): React.ReactElement {
  const searchParams = useSearchParams();
  const router = useRouter();
  const applicationId = searchParams.get("applicationId");

  React.useEffect(() => {
    if (!getApplicantToken()) {
      router.replace("/applicant/login?next=%2Fapplicant%2Fdashboard");
    }
  }, [router]);

  if (!applicationId) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        Missing application id. Start an application from the vacancy page.
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/apply">Browse vacancies</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8a6d2c]">
          New application
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#0b1d3a]">
          Complete your application
        </h1>
        <p className="mt-2 text-sm text-[#4b4943]">
          Progress through each section. You can upload supporting documents in
          the final step before submitting.
        </p>
      </header>

      <ApplicationWizard applicationId={applicationId} />
    </div>
  );
}

export default function NewApplicationPage(): React.ReactElement {
  return (
    <React.Suspense fallback={<div className="p-6 text-sm">Loading…</div>}>
      <NewApplicationBody />
    </React.Suspense>
  );
}
