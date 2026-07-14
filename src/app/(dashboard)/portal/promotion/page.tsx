/**
 * /portal/promotion — online promotion application (TOR 1.9.13 / EPM-014).
 *
 * Server Component: lists OPEN published vacancies and the employee's own
 * internal applications. Applying pre-fills the application from the 201 file
 * and routes it into the RPM applicant pipeline with the internal tag.
 */

import { requireAuth } from "@/lib/auth/guards";
import {
  getMyPromotionApplications,
  getOpenVacanciesForEmployees,
} from "@/lib/actions/portal/promotion";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { PromotionClient } from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Promotion Applications",
};

export default async function PortalPromotionPage() {
  const user = await requireAuth();

  if (!user.employeeId) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            No employee record is linked to your account. Contact HR to enable
            internal promotion applications.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [vacanciesResult, applicationsResult] = await Promise.all([
    getOpenVacanciesForEmployees(),
    getMyPromotionApplications(),
  ]);

  const vacancyRows = "data" in vacanciesResult ? vacanciesResult.data : [];
  const applications =
    "data" in applicationsResult ? applicationsResult.data : [];
  const loadError =
    "error" in vacanciesResult
      ? vacanciesResult.error
      : "error" in applicationsResult
        ? applicationsResult.error
        : null;

  // Dates must cross the RSC boundary as strings for the client shell.
  const vacancies = vacancyRows.map((v) => ({
    ...v,
    applicationDeadline: v.applicationDeadline.toISOString(),
  }));
  const myApplications = applications.map((a) => ({
    ...a,
    submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  }));

  const appliedVacancyTitles = new Set(myApplications.map((a) => a.itemNumber));

  return (
    <PromotionClient
      vacancies={vacancies}
      myApplications={myApplications}
      appliedItemNumbers={[...appliedVacancyTitles]}
      loadError={loadError}
    />
  );
}
