'use client';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/icons/Icon';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { useI18n } from '@/hooks/i18n';
import { cx } from '@/lib/cx';
import type { CaptureGuidance } from '@/services/face';
import type { MessageKey } from '@/i18n';
import styles from './Face.module.css';

const GUIDE: Readonly<Record<CaptureGuidance, { text: MessageKey; icon: IconName; tone: string; ring: string }>> = {
  find_face: { text: 'face.guideFind', icon: 'user', tone: styles.gError, ring: styles.ringMuted },
  move_closer: { text: 'face.guideCloser', icon: 'scan-face', tone: styles.gWarning, ring: styles.ringOn },
  hold_still: { text: 'face.guideStill', icon: 'camera', tone: styles.gInfo, ring: styles.ringOn },
  good: { text: 'face.guideGood', icon: 'check', tone: styles.gSuccess, ring: styles.ringGood },
  more_light: { text: 'face.guideLight', icon: 'sun', tone: styles.gWarning, ring: styles.ringWarn },
  one_face_only: { text: 'face.guideAlone', icon: 'users', tone: styles.gWarning, ring: styles.ringWarn },
};

const STEP_TITLES: readonly MessageKey[] = ['face.step1', 'face.step2', 'face.step3'];

/** Dark capture screen: progress, instruction, viewport with oval guide and a live guidance pill. */
interface CaptureViewProps {
  readonly step: number;
  readonly total: number;
  readonly guidance: CaptureGuidance;
  /** "Demo simulation · no photo is taken" while the face service is simulated. */
  readonly simulatedNote?: string;
  readonly onCancel: () => void;
}

export function CaptureView({ step, total, guidance, simulatedNote, onCancel }: CaptureViewProps) {
  const { t } = useI18n();
  const g = GUIDE[guidance];
  return (
    <ScreenLayout surface="inverse" banner={false} padding="none" footer={<Button variant="inverse" fullWidth onClick={onCancel}>{t('common.cancel')}</Button>}>
      <div className={styles.capture}>
        <div className={styles.progress}>
          <div className={styles.segments} aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={cx(styles.segment, i + 1 < step && styles.segDone, i + 1 === step && styles.segNow)} />
            ))}
          </div>
          <p className={styles.stepOf}>{t('face.stepOf', { step, total })}</p>
        </div>
        <h1 className={styles.captureTitle}>{t(STEP_TITLES[step - 1] ?? 'face.step1')}</h1>
        <div className={styles.viewport} aria-hidden="true">
          <Icon name="user" size={140} strokeWidth={1} className={styles.placeholder} />
          <span className={cx(styles.captureOval, g.ring)} />
          <span className={styles.pillWrap}>
            <span className={cx(styles.guide, g.tone)}>
              <Icon name={g.icon} size={18} />
              {t(g.text)}
            </span>
          </span>
        </div>
        {/* The pill shows the live guidance; screen readers hear it here once, the visible hint stays steady. */}
        <p className="visually-hidden" role="status">
          {t(g.text)}
        </p>
        <p className={styles.hint}>{t('face.hint')}</p>
        {simulatedNote && (
          <p className={styles.simulatedNote}>
            <Icon name="info" size={16} />
            {simulatedNote}
          </p>
        )}
      </div>
    </ScreenLayout>
  );
}
