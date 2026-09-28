'use client';
import { useCallback, useSyncExternalStore } from 'react';
import type { SyncStatus } from '@/services/sync';
import { useContainer } from './services';

/** Live sync/connectivity status for banners and pending cards. */
export function useSyncStatus(): SyncStatus {
  const { bus, services } = useContainer();
  const subscribe = useCallback((onChange: () => void) => bus.subscribe(['offline', 'attendance', 'staff', 'demo'], onChange), [bus]);
  return useSyncExternalStore(
    subscribe,
    () => cachedStatus(services.sync.status()),
    () => SERVER_STATUS,
  );
}

const SERVER_STATUS: SyncStatus = { phase: 'idle', online: true, pending: 0, lastFailure: null };
let last: SyncStatus = SERVER_STATUS;
/** useSyncExternalStore needs a stable snapshot identity while nothing changed. */
function cachedStatus(next: SyncStatus): SyncStatus {
  const sameFailure = last.lastFailure?.at === next.lastFailure?.at && last.lastFailure?.trigger === next.lastFailure?.trigger;
  if (last.phase === next.phase && last.online === next.online && last.pending === next.pending && sameFailure) return last;
  last = next;
  return next;
}
