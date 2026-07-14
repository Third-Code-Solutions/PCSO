/**
 * /portal/forms — official blank HR forms download (TOR 1.9.10 / EPM-015).
 *
 * Server Component: static catalog of downloadable blank forms; the client
 * shell calls the render action per form and triggers the browser download.
 */

import { requireAuth } from "@/lib/auth/guards";
import { FormsClient } from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HR Forms",
};

export default async function PortalFormsPage() {
  await requireAuth();
  return <FormsClient />;
}
