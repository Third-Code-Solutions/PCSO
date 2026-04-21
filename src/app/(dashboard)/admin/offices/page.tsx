/**
 * Admin — Offices CRUD page
 *
 * Lists all PCSO offices, sectors, and branches.
 * Create, edit (inline dialog), and soft-delete.
 */

import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layouts/page-header";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { requirePermission } from "@/lib/auth/guards";
import { OfficesClient } from "./_client";

export const metadata: Metadata = {
  title: "Manage Offices",
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

interface OfficeListRow {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId: string | null;
  parentName: string | null;
  headEmployeeName: string | null;
  plantillaCount: number;
  memberCount: number;
  createdAt: string;
}

async function getOfficeList(): Promise<OfficeListRow[]> {
  const supabase = await createServerClient();

  const { data: offices, error } = await supabase
    .from("offices")
    .select(
      `
      id,
      name,
      code,
      type,
      parent_id,
      head_employee_id,
      created_at,
      employees(first_name, last_name)
    `,
    )
    .is("deleted_at", null)
    .order("name");

  if (error) throw new Error(`Failed to fetch offices: ${error.message}`);

  // Build parent name map
  const allOffices = offices ?? [];
  const parentNames = new Map<string, string>(
    allOffices.map((o) => [o.id as string, o.name as string]),
  );

  // Plantilla position counts
  const { data: posCounts } = await supabase
    .from("plantilla_positions")
    .select("office_id")
    .is("deleted_at", null);

  const posMap = new Map<string, number>();
  for (const pos of posCounts ?? []) {
    const oid = pos.office_id as string;
    posMap.set(oid, (posMap.get(oid) ?? 0) + 1);
  }

  // Employee member counts
  const { data: empCounts } = await supabase
    .from("employees")
    .select("office_id")
    .eq("status", "active")
    .is("deleted_at", null);

  const empMap = new Map<string, number>();
  for (const emp of empCounts ?? []) {
    const oid = emp.office_id as string | null;
    if (oid) empMap.set(oid, (empMap.get(oid) ?? 0) + 1);
  }

  return allOffices.map((row) => {
    const headEmp = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees;
    return {
      id: row.id as string,
      name: row.name as string,
      code: row.code as string,
      type: row.type as string,
      parentId: row.parent_id as string | null,
      parentName: row.parent_id
        ? (parentNames.get(row.parent_id as string) ?? null)
        : null,
      headEmployeeName: headEmp
        ? `${(headEmp as { first_name: string }).first_name} ${(headEmp as { last_name: string }).last_name}`
        : null,
      plantillaCount: posMap.get(row.id as string) ?? 0,
      memberCount: empMap.get(row.id as string) ?? 0,
      createdAt: row.created_at as string,
    };
  });
}

async function getEmployeeOptions(): Promise<
  { id: string; firstName: string; lastName: string; positionTitle: string }[]
> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("employees")
    .select("id, first_name, last_name, position_title")
    .eq("status", "active")
    .is("deleted_at", null)
    .order("last_name");

  return (data ?? []).map((row) => ({
    id: row.id as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    positionTitle: row.position_title as string,
  }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminOfficesPage() {
  await requirePermission("admin", "view");

  const [offices, employees] = await Promise.all([
    getOfficeList(),
    getEmployeeOptions(),
  ]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Offices"
        description={`Manage PCSO offices, sectors, branches, and their hierarchy. ${offices.length.toLocaleString()} active.`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin" },
          { label: "Offices" },
        ]}
      />

      <OfficesClient offices={offices} employees={employees} />

      {/* Realtime: re-renders when offices, plantilla, or employees change */}
      <RealtimeBoundary
        tables={["offices", "plantilla_positions", "employees"]}
      />
    </div>
  );
}
