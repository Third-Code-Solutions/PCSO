'use client';

/**
 * Thin wrapper around useRealtimeTable that forces a simple router.refresh()
 * on each event, without needing a TanStack Query cache.
 * Use in Server Component pages wrapped by a tiny Client boundary.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

export function useRealtimeRefresh(tables: readonly string[]) {
  const router = useRouter();

  useEffect(() => {
    if (tables.length === 0) return;
    const supabase = createBrowserClient();
    const channel = supabase.channel(`refresh:${tables.join(':')}`);

    for (const table of tables) {
      channel.on(
        // @ts-expect-error — postgres_changes runtime event
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => router.refresh(),
      );
    }

    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, tables]);
}
