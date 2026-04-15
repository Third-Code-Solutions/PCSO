'use client';

import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';

/**
 * Creates a Supabase client for use in Client Components.
 * Uses the public anon key — never the service role key.
 *
 * Call this inside a Client Component or custom hook; do NOT call at module
 * scope (each call allocates a new client instance).
 */
export function createBrowserClient() {
  return createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
