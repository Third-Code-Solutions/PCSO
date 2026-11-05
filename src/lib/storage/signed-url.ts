import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/** Default lifetime of a generated-document download link. */
export const DOCUMENT_URL_TTL_SECONDS = 10 * 60;

/**
 * Normalises a stored storage reference to an object path inside `bucket`.
 *
 * Generated-document columns historically stored `getPublicUrl()` output, which
 * is dead on private buckets (H-19). New rows store the object path; this
 * accepts both so old rows keep working.
 */
export function toObjectPath(bucket: string, stored: string): string {
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
  ];
  for (const marker of markers) {
    const at = stored.indexOf(marker);
    if (at !== -1) {
      const rest = stored.slice(at + marker.length).split("?")[0] ?? "";
      return decodeURIComponent(rest);
    }
  }
  return stored.replace(/^\/+/, "");
}

/**
 * Returns a short-lived signed URL for a private-bucket object, or null when
 * signing fails. Uses the service role: callers MUST authorize the viewer
 * against the owning record before calling this.
 */
export async function signedObjectUrl(
  bucket: string,
  stored: string | null | undefined,
  ttlSeconds: number = DOCUMENT_URL_TTL_SECONDS,
): Promise<string | null> {
  if (!stored) return null;
  const path = toObjectPath(bucket, stored);
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) {
    console.error(
      `[storage] could not sign ${bucket}/${path}:`,
      error?.message ?? "no URL returned",
    );
    return null;
  }
  return data.signedUrl;
}
