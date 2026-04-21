"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, BellRing, CheckCheck, Inbox, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useNotifications,
  type NotificationRow,
} from "@/hooks/use-notifications";
import { cn } from "@/lib/utils/cn";

const VISIBLE_LIMIT = 20;
const MOBILE_BREAKPOINT_PX = 640;

type ConnectionStatus = "connected" | "polling" | "error";

/**
 * Top-bar notification bell.
 *
 * - Realtime unread badge (hidden when zero).
 * - Popover (desktop) / full-screen Dialog (mobile) with the latest
 *   `VISIBLE_LIMIT` notifications.
 * - Mark-all-read, clear-all (confirm), and per-item navigate + mark-read.
 * - Connection status dot: green realtime, yellow polling fallback, red error.
 */
export function NotificationBell() {
  const { items, loading, unreadCount, markRead, markAllRead, clearAll } =
    useNotifications();

  const [open, setOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const status = useConnectionStatus(loading);

  // Close on Escape (Popover/Dialog already handle this, but we guard the
  // AlertDialog-while-open case and add belt-and-braces coverage).
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !confirmOpen) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, confirmOpen]);

  const visibleItems = items.slice(0, VISIBLE_LIMIT);
  const BellIcon = unreadCount > 0 ? BellRing : Bell;
  const ariaLabel =
    unreadCount > 0
      ? `Notifications, ${unreadCount} unread`
      : "Notifications, 0 unread";

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={isMobile ? () => setOpen(true) : undefined}
    >
      <BellIcon
        className={cn("h-5 w-5", unreadCount > 0 && "text-pcso-navy")}
      />
      {unreadCount > 0 && (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm"
          aria-hidden
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
      <ConnectionDot
        status={status}
        className="absolute -bottom-0.5 -left-0.5"
      />
    </Button>
  );

  const panel = (
    <NotificationPanel
      items={visibleItems}
      loading={loading}
      unreadCount={unreadCount}
      status={status}
      onMarkAllRead={() => void markAllRead()}
      onMarkRead={(id) => void markRead(id)}
      onNavigate={() => setOpen(false)}
      onClearAll={() => {
        void clearAll();
        setConfirmOpen(false);
      }}
      confirmOpen={confirmOpen}
      onConfirmOpenChange={setConfirmOpen}
    />
  );

  // Mobile: full-screen Dialog (no Sheet component in this codebase — Dialog
  // with full-viewport sizing is the closest native equivalent and preserves
  // focus trap + aria-modal semantics out of the box).
  if (isMobile) {
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            className="left-0 top-0 h-[100dvh] max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 p-0 data-[state=closed]:slide-out-to-left-0 data-[state=open]:slide-in-from-left-0"
            onEscapeKeyDown={() => setOpen(false)}
          >
            <DialogTitle className="sr-only">Notifications</DialogTitle>
            <div className="flex h-full flex-col">{panel}</div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Desktop: Popover
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-96 p-0"
        onEscapeKeyDown={() => setOpen(false)}
      >
        {panel}
      </PopoverContent>
    </Popover>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface NotificationPanelProps {
  items: NotificationRow[];
  loading: boolean;
  unreadCount: number;
  status: ConnectionStatus;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onNavigate: () => void;
  onClearAll: () => void;
  confirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
}

function NotificationPanel({
  items,
  loading,
  unreadCount,
  status,
  onMarkAllRead,
  onMarkRead,
  onNavigate,
  onClearAll,
  confirmOpen,
  onConfirmOpenChange,
}: NotificationPanelProps) {
  const hasAny = items.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-sm font-semibold">Notifications</h3>
          <ConnectionStatusLabel status={status} />
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-pcso-navy transition-colors hover:bg-pcso-cream/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
          >
            <CheckCheck className="h-3 w-3" />
            Mark all as read
          </button>
        )}
      </header>

      {/* List */}
      <div className="flex-1 overflow-y-auto sm:max-h-96">
        {loading ? (
          <LoadingList />
        ) : !hasAny ? (
          <EmptyNotifications />
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onMarkRead={() => onMarkRead(n.id)}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      {!loading && hasAny && (
        <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-3 py-2">
          <AlertDialog open={confirmOpen} onOpenChange={onConfirmOpenChange}>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                aria-label={`Clear all ${items.length} notifications`}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-3 w-3" />
                Clear all
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes every notification in your inbox,
                  including unread items. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onClearAll}
                  className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
                >
                  Delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

// ─── Item ─────────────────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: NotificationRow;
  onMarkRead: () => void;
  onNavigate: () => void;
}

function NotificationItem({
  notification,
  onMarkRead,
  onNavigate,
}: NotificationItemProps) {
  const isUnread = notification.readAt === null;

  const body = (
    <div
      className={cn(
        "flex gap-2 px-4 py-3 transition-colors hover:bg-muted/50",
        isUnread && "bg-pcso-cream/40",
      )}
    >
      <span
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          isUnread ? "bg-pcso-gold" : "bg-transparent",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight text-foreground">
          {notification.title}
        </p>
        {notification.body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {notification.body}
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {safeTimeAgo(notification.createdAt)}
        </p>
      </div>
    </div>
  );

  function handleClick() {
    if (isUnread) onMarkRead();
    if (notification.actionUrl) onNavigate();
  }

  return (
    <li>
      {notification.actionUrl ? (
        <Link
          href={notification.actionUrl}
          onClick={handleClick}
          className="block focus:outline-none focus-visible:bg-muted/60"
        >
          {body}
        </Link>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="block w-full text-left focus:outline-none focus-visible:bg-muted/60"
        >
          {body}
        </button>
      )}
    </li>
  );
}

// ─── States ───────────────────────────────────────────────────────────────────

function LoadingList() {
  return (
    <ul className="divide-y" aria-busy="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="px-4 py-3">
          <div className="flex gap-2">
            <Skeleton className="mt-1.5 h-2 w-2 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyNotifications() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-3 text-sm font-medium">You have no notifications</p>
      <p className="mt-1 text-xs text-muted-foreground">
        New notifications will show up here in real time.
      </p>
    </div>
  );
}

// ─── Connection indicator ─────────────────────────────────────────────────────

interface ConnectionDotProps {
  status: ConnectionStatus;
  className?: string;
}

function ConnectionDot({ status, className }: ConnectionDotProps) {
  const color =
    status === "connected"
      ? "bg-green-500"
      : status === "polling"
        ? "bg-yellow-500"
        : "bg-red-500";
  const label =
    status === "connected"
      ? "Realtime connected"
      : status === "polling"
        ? "Polling fallback"
        : "Connection error";
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={cn(
        "h-2 w-2 rounded-full ring-2 ring-background",
        color,
        className,
      )}
    />
  );
}

function ConnectionStatusLabel({ status }: { status: ConnectionStatus }) {
  const text =
    status === "connected"
      ? "Live"
      : status === "polling"
        ? "Polling"
        : "Offline";
  const color =
    status === "connected"
      ? "text-green-600"
      : status === "polling"
        ? "text-yellow-600"
        : "text-red-600";
  return (
    <span
      className={cn("flex items-center gap-1 text-[11px] font-medium", color)}
      aria-live="polite"
    >
      <ConnectionDot status={status} />
      {text}
    </span>
  );
}

// ─── Hooks & helpers ──────────────────────────────────────────────────────────

/**
 * Viewport-width media query → mobile boolean. SSR-safe: starts false so the
 * initial render matches the server, then hydrates to the real value.
 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

/**
 * Best-effort realtime connection status. The hook does not expose raw channel
 * state, so we infer from `navigator.onLine`, hydration, and a load timeout:
 *   - red   → offline OR hook took too long to finish loading
 *   - yellow → browser online but navigator reports no-realtime (tab hidden)
 *   - green → everything healthy
 */
function useConnectionStatus(loading: boolean): ConnectionStatus {
  const [status, setStatus] = React.useState<ConnectionStatus>("connected");

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let loadTimer: ReturnType<typeof setTimeout> | null = null;

    const compute = () => {
      if (!navigator.onLine) {
        setStatus("error");
        return;
      }
      if (document.visibilityState === "hidden") {
        setStatus("polling");
        return;
      }
      setStatus("connected");
    };

    compute();

    // If the initial load stalls for >5s, surface a degraded state.
    if (loading) {
      loadTimer = setTimeout(() => {
        if (navigator.onLine) setStatus("polling");
        else setStatus("error");
      }, 5000);
    }

    window.addEventListener("online", compute);
    window.addEventListener("offline", compute);
    document.addEventListener("visibilitychange", compute);
    return () => {
      if (loadTimer) clearTimeout(loadTimer);
      window.removeEventListener("online", compute);
      window.removeEventListener("offline", compute);
      document.removeEventListener("visibilitychange", compute);
    };
  }, [loading]);

  return status;
}

/**
 * `formatDistanceToNow` throws on invalid dates. Guard defensively so a
 * malformed row cannot crash the bell.
 */
function safeTimeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "just now";
  }
}
