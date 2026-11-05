/**
 * /performance/nosi/[id] — NOSI download (H-19).
 *
 * The NOSI PDF lives in the private "documents" bucket; the step_increments
 * row stores its object path. Authorize the viewer against the increment,
 * then hand out a short-lived signed URL. Target of the
 * step_increment_implemented notification.
 */

import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { effectiveRolesOf, hasPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedObjectUrl } from "@/lib/storage/signed-url";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NosiDownloadPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const { data: increment } = await supabaseAdmin
    .from("step_increments")
    .select("id, employee_id, nosi_document_url")
    .eq("id", id)
    .maybeSingle();
  if (!increment?.nosi_document_url) notFound();

  const isOwn =
    user.employeeId !== null &&
    user.employeeId === String(increment.employee_id);
  const isHr = hasPermission(user.role, "performance", "edit");
  const isReadOnlyOversight = effectiveRolesOf(user.role).includes("viewer");
  if (!isOwn && !isHr && !isReadOnlyOversight) notFound();

  const url = await signedObjectUrl(
    "documents",
    String(increment.nosi_document_url),
  );
  if (!url) notFound();
  redirect(url);
}
