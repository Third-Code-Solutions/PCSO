"use client";

import * as React from "react";
import { AppSidebar } from "@/components/layouts/app-sidebar";
import { TopNav } from "@/components/layouts/top-nav";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createBrowserClient } from "@/lib/supabase/client";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const auth = useCurrentUser();

  function handleToggleSidebar() {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setSidebarOpen((v) => !v);
    } else {
      setMobileOpen((v) => !v);
    }
  }

  const handleSignOut = React.useCallback(async () => {
    // Sign out on the client (clears local cache + fires onAuthStateChange)
    // then hit the server route to clear the session cookies and redirect.
    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore — the server route below will still tear down the session cookies.
    }
    window.location.href = "/api/auth/signout";
  }, []);

  const displayName = auth.user?.email?.split("@")[0] ?? "User";
  const displayEmail = auth.user?.email ?? "";
  const role = auth.user?.role ?? "employee_self_service";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar
        open={sidebarOpen}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        role={role}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav
          sidebarOpen={sidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          breadcrumbs={[{ label: "PCSO HRIS" }]}
          user={{ name: displayName, email: displayEmail }}
          onSignOut={handleSignOut}
        />

        <main
          className="flex-1 overflow-y-auto"
          id="main-content"
          tabIndex={-1}
        >
          <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
