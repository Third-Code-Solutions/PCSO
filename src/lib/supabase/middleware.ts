import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase session inside Next.js middleware.
 *
 * Must be called at the top of every middleware run so that the session
 * cookie is kept alive. Returns the (possibly updated) response object
 * along with the authenticated user (null when unauthenticated).
 *
 * IMPORTANT: Do NOT import `createServerClient` from `@/lib/supabase/server`
 * here — that helper uses `next/headers` which is not available in middleware.
 * Instead we construct the client inline with the middleware-compatible API.
 */
export async function refreshSession(request: NextRequest) {
  // Start with a plain pass-through response; we may mutate its cookies below.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update both the outgoing request and the response so that
          // server components downstream see the refreshed cookies.
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // getUser() triggers a token refresh if the session is expiring soon.
  // Do NOT use getSession() here — it does not validate the JWT server-side.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
