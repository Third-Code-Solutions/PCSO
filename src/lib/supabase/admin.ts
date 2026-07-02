import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * SERVER-ONLY Supabase admin client using the service role key.
 *
 * - Bypasses Row Level Security — use only for trusted server-side operations
 *   such as trigger sync, seeding, or admin user management.
 * - NEVER import this file in Client Components, hooks, or any path that
 *   could be bundled for the browser.
 * - The service role key is intentionally NOT prefixed with NEXT_PUBLIC_.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    '[supabase/admin] This module must only be imported on the server. ' +
      'Never expose the service role key to the client bundle.',
  );
}

// Lazily created on first use so importing this module never fails the
// production build (`next build` loads route modules without runtime secrets).
// Env is validated at first actual use, not at module load.
let cached: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) {
    throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');
  }
  cached = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseAdmin(), prop, receiver);
  },
});
