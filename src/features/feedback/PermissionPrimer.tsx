'use client';
import { Button } from '@/components/ui/Button';
import { IconWell } from '@/components/ui/IconWell';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { useI18n } from '@/hooks/i18n';
import styles from './Feedback.module.css';

interface PermissionPrimerProps {
  readonly kind: 'location' | 'camera';
  readonly purpose?: 'enrol' | 'verify';
  readonly onAllow: () => void;
  readonly onNotNow: () => void;
}

/** Explains WHY before the OS prompt, one permission at a time (prototype perm screen). */
export function PermissionPrimer({ kind, purpose = 'verify', onAllow, onNotNow }: PermissionPrimerProps) {
  const { t } = useI18n();
  const location = kind === 'location';
  return (
    <ScreenLayout
      surface="default"
      padding="center"
      footer={
        <>
          <Button fullWidth onClick={onAllow}>
            {location ? t('permission.allowLocation') : t('permission.allowCamera')}
          </Button>
          <Button variant="ghost" fullWidth onClick={onNotNow}>
            {t('permission.notNow')}
          </Button>
        </>
      }
    >
      <IconWell icon={location ? 'map-pin' : 'camera'} tone="brand" size={96} />
      <div className={styles.text}>
        <h1 className={styles.title}>{location ? t('permission.locationTitle') : t('permission.cameraTitle')}</h1>
        <p className={styles.body}>
          {location ? t('permission.locationBody') : purpose === 'enrol' ? t('permission.cameraBodyEnrol') : t('permission.cameraBodyVerify')}
        </p>
      </div>
    </ScreenLayout>
  );
}
