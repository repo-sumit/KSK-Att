'use client';
import type { RefObject } from 'react';
import { Icon } from '@/components/ui/icons/Icon';
import { useI18n } from '@/hooks/i18n';
import { cx } from '@/lib/cx';
import { GUIDE } from './guidance';
import type { FaceRunState } from './useFaceCapture';
import styles from './Face.module.css';

/** Preview aspect (width / height) per size: the check measures framing against what is visible. */
export const VIEW_ASPECT = { enrol: 4 / 5, verify: 248 / 300 } as const;

interface CameraViewProps {
  readonly video: RefObject<HTMLVideoElement | null>;
  readonly state: FaceRunState;
  readonly onTapToStart: () => void;
  /** enrol: the dark full-screen capture · verify: the frame inside the verification screen. */
  readonly size: 'enrol' | 'verify';
}

/**
 * The live preview (mirrored, like a mirror), the oval guide and the live
 * guidance pill. A simulated camera shows the silhouette instead of video.
 */
export function CameraView({ video, state, size, onTapToStart }: CameraViewProps) {
  const { t } = useI18n();
  const guidance = state.phase === 'running' ? state.guidance : 'starting';
  const g = GUIDE[guidance];
  const text = t(g.text, { count: state.phase === 'running' ? (state.countdown ?? 3) : 3 });
  const live = state.phase === 'running' && state.source === 'device';
  return (
    <>
      <div className={cx(styles.viewport, styles[`vp-${size}`])}>
        <video ref={video} className={cx(styles.video, live && styles.videoLive)} autoPlay muted playsInline aria-hidden="true" />
        {!live && <Icon name="user" size={size === 'enrol' ? 140 : 120} strokeWidth={1} className={styles.placeholder} />}
        <span className={cx(styles.captureOval, styles[`ring-${g.ring}`])} aria-hidden="true" />
        {state.phase === 'tap' ? (
          <span className={styles.pillWrap}>
            <button type="button" className={styles.tapStart} onClick={onTapToStart}>
              <Icon name="camera" size={18} />
              {t('face.tapToStart')}
            </button>
          </span>
        ) : (
          <span className={styles.pillWrap} aria-hidden="true">
            <span className={cx(styles.guide, styles[`g-${g.tone}`])}>
              <Icon name={g.icon} size={18} />
              {text}
            </span>
          </span>
        )}
      </div>
      {/* The pill shows the live guidance; screen readers hear it here. */}
      <p className="visually-hidden" role="status">
        {text}
      </p>
    </>
  );
}
