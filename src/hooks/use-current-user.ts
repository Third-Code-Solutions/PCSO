'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Role } from '@/lib/auth/permissions';

export interface CurrentUserClient {
  id: string;
  email: string;
  role: Role;
  officeId: string | null;
  employeeId: string | null;
}

type UseCurrentUserResult =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: CurrentUserClient }
  | { status: 'unauthenticated'; user: null };

/**
 * Client-side hook that returns the authenticated user's identity and role.
 *
 * Reads session state from the browser Supabase client. Subscribes to
 * `onAuthStateChange` so the value is updated on sign-in / sign-out without
 * a full page reload.
 *
 * For permission checks prefer `usePermissions()` which combines this hook
 * with the `hasPermission()` predicate.
 */
export function useCurrentUser(): UseCurrentUserResult {
  const [result, setResult] = useState<UseCurrentUserResult>({ status: 'loading', user: null });

  useEffect(() => {
    const supabase = createBrowserClient();

    function buildUser(
      authUser: { id: string; email?: string; user_metadata: Record<string, unknown> } | null,
    ): UseCurrentUserResult {
      if (!authUser) return { status: 'unauthenticated', user: null };

      const meta = authUser.user_metadata;
      const role = (meta['role'] as Role | undefined) ?? 'employee_self_service';
      const officeId = typeof meta['office_id'] === 'string' ? meta['office_id'] : null;
      const employeeId = typeof meta['employee_id'] === 'string' ? meta['employee_id'] : null;

      return {
        status: 'authenticated',
        user: {
          id: authUser.id,
          email: authUser.email ?? '',
          role,
          officeId,
          employeeId,
        },
      };
    }

    // Seed the initial state from the local session cache.
    supabase.auth.getUser().then(({ data }) => {
      setResult(buildUser(data.user));
    });

    // Keep in sync with auth state changes (sign-in, sign-out, token refresh).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setResult(buildUser(session?.user ?? null));
    });

    return () => subscription.unsubscribe();
  }, []);

  return result;
}
