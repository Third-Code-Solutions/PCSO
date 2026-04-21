/**
 * Interactive Org Chart — Phase 06
 *
 * Displays the PCSO office hierarchy as a pure-SVG interactive tree.
 * Click a node to see office head + member count.
 * Export button generates a PDF via React-PDF.
 */

import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { OrgChartClient } from "./_client";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";

export const metadata: Metadata = {
  title: "Org Chart",
};

// ---------------------------------------------------------------------------
// Data types for the org tree
// ---------------------------------------------------------------------------

interface RawOffice {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId: string | null;
  headEmployeeName: string | null;
  memberCount: number;
  totalPositions: number;
  filledPositions: number;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getOrgChartData(): Promise<RawOffice[]> {
  const supabase = await createServerClient();

  // Fetch all offices with head employee name
  const { data: officesData, error: offErr } = await supabase
    .from("offices")
    .select(
      `
      id,
      name,
      code,
      type,
      parent_id,
      head_employee_id,
      employees(first_name, last_name)
    `,
    )
    .is("deleted_at", null)
    .order("name");

  if (offErr) throw new Error(`Failed to fetch offices: ${offErr.message}`);

  // Fetch employee counts per office
  const { data: empCounts } = await supabase
    .from("employees")
    .select("office_id")
    .eq("status", "active")
    .is("deleted_at", null);

  const empCountMap = new Map<string, number>();
  for (const emp of empCounts ?? []) {
    const oid = emp.office_id as string | null;
    if (oid) {
      empCountMap.set(oid, (empCountMap.get(oid) ?? 0) + 1);
    }
  }

  // Fetch plantilla position counts per office
  const { data: positions } = await supabase
    .from("plantilla_positions")
    .select("office_id, is_filled")
    .is("deleted_at", null);

  const totalPositionMap = new Map<string, number>();
  const filledPositionMap = new Map<string, number>();
  for (const pos of positions ?? []) {
    const oid = pos.office_id as string;
    totalPositionMap.set(oid, (totalPositionMap.get(oid) ?? 0) + 1);
    if (pos.is_filled as boolean) {
      filledPositionMap.set(oid, (filledPositionMap.get(oid) ?? 0) + 1);
    }
  }

  return (officesData ?? []).map((row) => {
    const headEmp = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees;
    return {
      id: row.id as string,
      name: row.name as string,
      code: row.code as string,
      type: row.type as string,
      parentId: row.parent_id as string | null,
      headEmployeeName: headEmp
        ? `${(headEmp as { first_name: string }).first_name} ${(headEmp as { last_name: string }).last_name}`
        : null,
      memberCount: empCountMap.get(row.id as string) ?? 0,
      totalPositions: totalPositionMap.get(row.id as string) ?? 0,
      filledPositions: filledPositionMap.get(row.id as string) ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Build tree structure from flat list
// ---------------------------------------------------------------------------

interface OrgTreeNode {
  id: string;
  name: string;
  code: string;
  type: string;
  headEmployeeName: string | null;
  memberCount: number;
  totalPositions: number;
  filledPositions: number;
  children: OrgTreeNode[];
}

function buildTree(offices: RawOffice[]): OrgTreeNode[] {
  const nodeMap = new Map<string, OrgTreeNode>();

  for (const office of offices) {
    nodeMap.set(office.id, { ...office, children: [] });
  }

  const roots: OrgTreeNode[] = [];

  for (const office of offices) {
    const node = nodeMap.get(office.id);
    if (!node) continue;

    if (!office.parentId) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(office.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found (deleted?) — treat as root
        roots.push(node);
      }
    }
  }

  // Sort children alphabetically
  function sortChildren(node: OrgTreeNode) {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of node.children) {
      sortChildren(child);
    }
  }
  for (const root of roots) {
    sortChildren(root);
  }
  roots.sort((a, b) => a.name.localeCompare(b.name));

  return roots;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function OrgChartPage() {
  await requirePermission("plantilla", "view");
  const offices = await getOrgChartData();
  const roots = buildTree(offices);

  return (
    <div className="flex flex-col h-full min-h-0">
      <RealtimeBoundary tables={["offices", "employees"]} />
      <PageHeader
        title="Organization Chart"
        description="Interactive hierarchy of PCSO sectors, departments, branches, and offices."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Org Chart" },
        ]}
      />

      <OrgChartClient roots={roots} />
    </div>
  );
}
