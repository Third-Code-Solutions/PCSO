'use client';

import * as React from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NotificationBell } from '@/components/layouts/notification-bell';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { UserMenu } from '@/components/layouts/user-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TopNavProps {
  breadcrumbs?: BreadcrumbItem[];
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  user?: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  onSignOut?: () => void;
}

export function TopNav({
  breadcrumbs,
  sidebarOpen,
  onToggleSidebar,
  user,
  onSignOut,
}: TopNavProps) {
  const displayUser = user ?? {
    name: 'Senate Staff',
    email: 'staff@senate.gov.ph',
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background px-4 shadow-sm">
      {/* Sidebar toggle */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <PanelLeftOpen className="h-5 w-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Separator orientation="vertical" className="h-6" />

      {/* Breadcrumb */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex-1 hidden sm:flex">
          <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <li key={index} className="flex items-center gap-1.5">
                {index > 0 && (
                  <span className="text-muted-foreground/40" aria-hidden>
                    /
                  </span>
                )}
                {crumb.href && index < breadcrumbs.length - 1 ? (
                  <a
                    href={crumb.href}
                    className="hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span
                    className={
                      index === breadcrumbs.length - 1
                        ? 'text-foreground font-medium'
                        : undefined
                    }
                    aria-current={
                      index === breadcrumbs.length - 1 ? 'page' : undefined
                    }
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex-1" />

      {/* Notifications */}
      <NotificationBell />

      <Separator orientation="vertical" className="h-6" />

      {/* User menu */}
      <UserMenu
        name={displayUser.name}
        email={displayUser.email}
        avatarUrl={displayUser.avatarUrl}
        onSignOut={onSignOut}
      />
    </header>
  );
}
