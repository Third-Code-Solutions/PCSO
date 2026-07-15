import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { desc, isNull } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { apiClients } from "@/lib/db/schema";
import {
  ApiClientsTable,
  CreateApiClientButton,
  type ApiClientRow,
} from "./_client";

export const metadata: Metadata = {
  title: "API Clients — Admin",
};

export const dynamic = "force-dynamic";

/**
 * /admin/api-clients — machine credential management for the public REST
 * API v1 (TOR 3.3.2 / 3.3.4). Super Admin only (ROUTE_ACCESS "/admin").
 */
export default async function ApiClientsPage() {
  await requirePermission("admin", "view");

  const rows = await db
    .select()
    .from(apiClients)
    .where(isNull(apiClients.deletedAt))
    .orderBy(desc(apiClients.createdAt));

  const clients: ApiClientRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    clientId: row.clientId,
    scopes: row.scopes,
    rateLimitPerMinute: row.rateLimitPerMinute,
    isActive: row.isActive,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }));

  const activeCount = clients.filter((c) => c.isActive).length;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="API Clients"
        description={`${clients.length.toLocaleString()} credential${clients.length !== 1 ? "s" : ""} — ${activeCount.toLocaleString()} active. Keys authenticate external systems against the public REST API v1.`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin" },
          { label: "API Clients" },
        ]}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/admin/api-clients/docs">
                <BookOpenText className="h-4 w-4" />
                API Docs
              </Link>
            </Button>
            <CreateApiClientButton />
          </div>
        }
      />

      <ApiClientsTable clients={clients} />
    </div>
  );
}
