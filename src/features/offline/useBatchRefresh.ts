'use client';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';

export type RefreshState = 'idle' | 'refreshing' | 'done';

/** How long "Updated just now" is said before the row goes back to the time of the refresh. */
export const JUST_NOW_MS = 60_000;

/**
 * Refreshes one downloaded batch (D-055). "done" ("Updated just now") lasts a
 * minute, then the row shows the refresh time. It is a timer, not the clock:
 * the demo's clock is fixed, so a computed "just now" would never age.
 */
export function useBatchRefresh(batchId: string) {
  const ctx = useSession();
  const { packs } = useServices();
  const toast = useToast();
  const { t } = useI18n();
  const [state, setState] = useState<RefreshState>('idle');
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  const refresh = async () => {
    if (state === 'refreshing') return;
    clearTimeout(timer.current);
    setState('refreshing');
    const result = await packs.refreshBatch(ctx, batchId);
    if (!alive.current) return;
    if (result.ok) {
      setState('done');
      timer.current = setTimeout(() => alive.current && setState('idle'), JUST_NOW_MS);
      return;
    }
    setState('idle');
    toast.show(result.error === 'offline' ? t('offline.connectFirst') : t('batchData.failed'));
  };
  return { state, refresh };
}

