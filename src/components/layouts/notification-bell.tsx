'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, BellRing, CheckCheck, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotifications, type NotificationRow } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils/cn';

const VISIBLE_INITIAL = 10;
const LOAD_MORE_STEP = 10;

/**
 * Top-bar notification bell. Subscribes to realtime updates for the current
 * user, shows an unread badge, and lets the user:
 *  - mark a single notification as read (click-through)
 *  - mark every notification as read at once
 *  - load older notifications in batches
 *  - navigate to the notification's action URL when present
 */
export function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead, loading } = useNotifications();
  const [visible, setVisible] = React.useState(VISIBLE_INITIAL);
  const [open, setOpen] = React.useState(false);

  // Reset pagination whenever the dropdown closes, so reopening starts fresh.
  React.useEffect(() => {
    if (!open) setVisible(VISIBLE_INITIAL);
  }, [open]);

  const visibleItems = items.slice(0, visible);
  const hasMore = items.length > visible;
  const BellIcon = unreadCount > 0 ? BellRing : Bell;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0
              ? `Notifications (${unreadCount} unread)`
              : 'Notifications'
          }
        >
          <BellIcon
            className={cn(
              'h-5 w-5',
              unreadCount > 0 && 'text-senate-navy',
            )}
          />
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm"
              aria-hidden
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-96 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {items.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : 'All caught up'}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => void markAllRead()}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-senate-navy hover:bg-senate-cream/50 transition-colors"
              type="button"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <LoadingList />
          ) : items.length === 0 ? (
            <EmptyNotifications />
          ) : (
            <ul className="divide-y">
              {visibleItems.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onMarkRead={() => void markRead(n.id)}
                  onNavigate={() => setOpen(false)}
                />
              ))}

              {hasMore && (
                <li>
                  <button
                    type="button"
                    onClick={() => setVisible((v) => v + LOAD_MORE_STEP)}
                    className="w-full py-2.5 text-center text-xs font-medium text-senate-navy hover:bg-muted/40 transition-colors"
                  >
                    Load older notifications
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function NotificationItem({
  notification,
  onMarkRead,
  onNavigate,
}: {
  notification: NotificationRow;
  onMarkRead: () => void;
  onNavigate: () => void;
}) {
  const isUnread = notification.readAt === null;

  const body = (
    <div
      className={cn(
        'flex gap-2 px-4 py-3 hover:bg-muted/50 transition-colors',
        isUnread && 'bg-senate-cream/40',
      )}
    >
      <span
        className={cn(
          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
          isUnread ? 'bg-senate-gold' : 'bg-transparent',
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
          className="w-full text-left focus:outline-none focus-visible:bg-muted/60"
        >
          {body}
        </button>
      )}
    </li>
  );
}

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
      <p className="mt-3 text-sm font-medium">You&rsquo;re all caught up</p>
      <p className="mt-1 text-xs text-muted-foreground">
        New notifications will show up here in real time.
      </p>
    </div>
  );
}

/**
 * `formatDistanceToNow` throws on invalid dates. Guard defensively so a
 * malformed row can never crash the bell.
 */
function safeTimeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return 'just now';
  }
}
