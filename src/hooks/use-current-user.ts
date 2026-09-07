"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/auth/permissions";

export interface CurrentUserClient {
  id: string;
  email: string;
  role: Role;
  officeId: string | null;
  employeeId: string | null;
}

type UseCurrentUserResult =
  | { status: "loading"; user: null }
  | { status: "authenticated"; user: CurrentUserClient }
  | { status: "unauthenticated"; user: null };

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
  const [result, setResult] = useState<UseCurrentUserResult>({
    status: "loading",
    user: null,
  });

  useEffect(() => {
    const supabase = createBrowserClient();
    let active = true;

    function buildUser(
      authUser: {
        id: string;
        email?: string;
        app_metadata: Record<string, unknown>;
      } | null,
    ): UseCurrentUserResult {
      if (!authUser) return { status: "unauthenticated", user: null };

      // Mirror the server: role/office/employee live in app_metadata (the
      // service-role-only claim store). Display-only — the server enforces authz.
      const meta = authUser.app_metadata;
      const role =
        (meta["role"] as Role | undefined) ?? "employee_self_service";
      const officeId =
        typeof meta["office_id"] === "string" ? meta["office_id"] : null;
      const employeeId =
        typeof meta["employee_id"] === "string" ? meta["employee_id"] : null;

      return {
        status: "authenticated",
        user: {
          id: authUser.id,
          email: authUser.email ?? "",
          role,
          officeId,
          employeeId,
        },
      };
    }

    // Seed display-only state from the local session cache. Server guards
    // still validate the session with getUser(); this avoids an extra auth
    // round-trip before the shell can render its role and navigation.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setResult(buildUser(data.session?.user ?? null));
      })
      .catch(() => {
        if (active) setResult({ status: "unauthenticated", user: null });
      });

    // Keep in sync with auth state changes (sign-in, sign-out, token refresh).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setResult(buildUser(session?.user ?? null));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return result;
}
