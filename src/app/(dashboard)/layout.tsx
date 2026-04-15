'use client';

import * as React from 'react';
import { AppSidebar } from '@/components/layouts/app-sidebar';
import { TopNav } from '@/components/layouts/top-nav';

// TODO: Replace with real auth check via createServerClient + redirect on server component.
// For now this layout is a client component shell; auth guard will be layered in Phase 05.

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  function handleToggleSidebar() {
    // On large screens: toggle collapsed/expanded
    // On small/medium screens: open/close mobile drawer
    if (window.innerWidth >= 1024) {
      setSidebarOpen((v) => !v);
    } else {
      setMobileOpen((v) => !v);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — desktop + mobile drawer */}
      <AppSidebar
        open={sidebarOpen}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        // TODO: Pass real role from Supabase session
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav
          sidebarOpen={sidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          breadcrumbs={[{ label: 'Senate HRIS' }]}
          // TODO: Pass real user data from Supabase session
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
