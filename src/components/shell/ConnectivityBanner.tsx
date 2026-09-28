'use client';
import { Banner } from '@/components/ui/Banner';
import { useT } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSyncStatus } from '@/hooks/useSync';

/**
 * Offline > syncing > failed (Try again) > synced flash, as in the prototype.
 * `offlineOnly`: screens with the Sync pending card (Home, Offline data) leave
 * sync to the card, so one screen never shows two sync messages (D-064).
 */
export function ConnectivityBanner({ offlineOnly = false }: { readonly offlineOnly?: boolean }) {
  const t = useT();
  const { sync } = useServices();
  const status = useSyncStatus();
  const count = status.pending;

  if (!status.online) return <Banner layout="bar" tone="warning" icon="wifi-off">{t('sync.offline')}</Banner>;
  if (offlineOnly) return null;
  if (status.phase === 'syncing') return <Banner layout="bar" tone="info" spinner>{t('sync.syncing', { count })}</Banner>;
  if (status.phase === 'failed')
    return (
      <Banner layout="bar" tone="error" icon="alert" action={{ label: t('common.tryAgain'), onPress: () => void sync.syncNow() }}>
        {t('sync.failed', { count })}
      </Banner>
    );
  if (status.phase === 'synced') return <Banner layout="bar" tone="success" icon="circle-check">{t('sync.synced')}</Banner>;
  // "Sync now" lives on the home pending card and the Offline data screen, not here.
  return null;
}
