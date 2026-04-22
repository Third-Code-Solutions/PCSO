/**
 * Plantilla of Personnel — list page
 *
 * Columns: Item No, Position Title, SG, Authorized Salary, Incumbent, Status
 * Filters: Office, Salary Grade, Status (Filled / Vacant), plus debounced search.
 * Pagination is server-side (50/page default, selectable 10/25/50/100).
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Plus, FileDown } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { PlantillaTableClient } from "./_client";
import { PlantillaListSkeleton } from "@/components/plantilla/plantilla-list-skeleton";
import {
  getPlantillaPositions,
  getOffices,
  getActiveEmployees,
} from "./queries";
import { PlantillaListParamsSchema } from "@/lib/validations/plantilla";
import { requireAuth } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Plantilla of Personnel",
};

interface PlantillaPageProps {
  searchParams: Promise<Record<string, string | string[]>>;
}

export default async function PlantillaPage({
  searchParams,
}: PlantillaPageProps) {
  await requireAuth();
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );

  // Validate + coerce all incoming filters before hitting the DB.
  const parsed = PlantillaListParamsSchema.safeParse(flat);
  const params = parsed.success
    ? parsed.data
    : PlantillaListParamsSchema.parse({});

  // Build export QS from validated filters only.
  const exportParams = new URLSearchParams();
  if (params.search) exportParams.set("search", params.search);
  if (params.officeId) exportParams.set("officeId", params.officeId);
  if (params.salaryGrade)
    exportParams.set("salaryGrade", String(params.salaryGrade));
  if (params.status !== "all") exportParams.set("status", params.status);
  const exportQS = exportParams.toString();

  const [{ rows, total }, offices, employees] = await Promise.all([
    getPlantillaPositions({
      page: params.page,
      perPage: params.perPage,
      search: params.search,
      officeId: params.officeId,
      salaryGrade: params.salaryGrade,
      status: params.status,
    }),
    getOffices(),
    getActiveEmployees(),
  ]);

  return (
    <div>
      <RealtimeBoundary tables={["plantilla_positions"]} />
      <PageHeader
        title="Plantilla of Personnel"
        description="Official record of authorized positions in the Philippine Charity Sweepstakes Office."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Plantilla" },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a
                href={
                  exportQS
                    ? `/api/plantilla/export?${exportQS}`
                    : "/api/plantilla/export"
                }
                download
              >
                <FileDown className="mr-2 h-4 w-4" />
                Export CSV
              </a>
            </Button>
            <Button size="sm" asChild>
              <Link href="/plantilla/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Position
              </Link>
            </Button>
          </>
        }
      />

      <Suspense
        fallback={<PlantillaListSkeleton rows={Math.min(params.perPage, 10)} />}
      >
        <PlantillaTableClient
          rows={rows}
          total={total}
          offices={offices}
          employees={employees}
          page={params.page}
          perPage={params.perPage}
          currentFilters={{
            search: params.search,
            officeId: params.officeId,
            salaryGrade: params.salaryGrade,
            status: params.status,
          }}
        />
      </Suspense>
    </div>
  );
}
