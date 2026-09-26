'use client';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/icons/Icon';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { cx } from '@/lib/cx';
import { LIVENESS_STEPS, type CapturedFrame } from '@/services/face';
import type { MessageKey } from '@/i18n';
import { CameraView, VIEW_ASPECT } from './CameraView';
import { useFaceCapture, type FaceRunFailure } from './useFaceCapture';
import styles from './Face.module.css';

const STEP_TITLES: readonly MessageKey[] = ['face.step1', 'face.step2', 'face.step3'];

interface CaptureViewProps {
  readonly onDone: (frames: CapturedFrame[]) => void;
  readonly onFail: (error: FaceRunFailure) => void;
  readonly onCancel: () => void;
  /** Photos taken; the registration is being saved. */
  readonly saving?: boolean;
  /** After repeated failed checks: timed guided capture instead of detection. */
  readonly guided?: boolean;
}

/** Dark registration screen: the three photos as they are taken, the step, the live camera and its guidance. */
export function CaptureView({ onDone, onFail, onCancel, saving, guided }: CaptureViewProps) {
  const { t } = useI18n();
  const { faceMatch } = useServices();
  const { video, state, tapToStart } = useFaceCapture('enrol', onDone, onFail, { guided, viewAspect: VIEW_ASPECT.enrol });
  const total = LIVENESS_STEPS.enrol.length;
  const running = state.phase === 'running' ? state : null;
  const thumbs = running?.thumbs ?? [];
  const step = Math.min(running?.step ?? 1, total);
  const note = running?.source === 'simulated' ? t('face.simulatedCamera') : faceMatch.simulated ? t('face.prototypeShort') : null;

  return (
    <ScreenLayout
      surface="inverse"
      banner={false}
      padding="none"
      width="form"
      footer={
        <>
          {/* In the footer, so it is always on screen however short the phone is. */}
          {note && (
            <p className={styles.simulatedNote}>
              <Icon name="info" size={16} />
              {note}
            </p>
          )}
          <Button variant="inverse" fullWidth disabled={saving} onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        </>
      }
    >
      <div className={styles.capture} data-captured={thumbs.length}>
        <div className={styles.progress}>
          {/* Each photo appears as it is taken (in memory only; discarded when this screen closes). */}
          <ol className={styles.slots} aria-hidden="true">
            {Array.from({ length: total }, (_, i) => {
              const src = thumbs[i];
              return (
                <li key={i} className={cx(styles.slot, src !== undefined && styles.slotDone, src === undefined && i + 1 === step && styles.slotNow)}>
                  {/* An in-memory object URL: next/image can't (and shouldn't) optimise it. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {src ? <img src={src} alt="" className={styles.thumb} /> : null}
                  {src !== undefined && (
                    <span className={styles.slotCheck}>
                      <Icon name="check" size={12} strokeWidth={3} />
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <p className={styles.stepOf}>{t('face.stepOf', { step: thumbs.length >= total ? total : step, total })}</p>
        </div>
        <h1 className={styles.captureTitle}>{saving ? t('face.saving') : t(STEP_TITLES[step - 1] ?? 'face.step1')}</h1>
        <CameraView video={video} state={state} size="enrol" onTapToStart={tapToStart} />
        <p className={styles.hint}>{running?.mode === 'guided' ? t('face.hintGuided') : t('face.hint')}</p>
      </div>
    </ScreenLayout>
  );
}
