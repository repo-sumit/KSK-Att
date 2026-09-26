'use client';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icons/Icon';
import { cx } from '@/lib/cx';
import styles from './VerifyRun.module.css';

type StepState = 'idle' | 'active' | 'done';

interface VerifyRunProps {
  readonly showLocationStep: boolean;
  readonly showFaceStep: boolean;
  readonly locationState: StepState;
  readonly faceState: StepState;
  readonly visual: 'location' | 'face';
  readonly success: boolean;
  readonly title: ReactNode;
  readonly subtitle: ReactNode;
  readonly labels: { readonly location: string; readonly identity: string };
  /** Shown under the face step while matching is simulated (or no camera is used). */
  readonly simulatedNote?: string;
  /** The live camera (FaceCheck) in place of the face placeholder. */
  readonly faceSlot?: ReactNode;
}

function Step({ state, icon, label }: { readonly state: StepState; readonly icon: 'map-pin' | 'scan-face'; readonly label: string }) {
  return (
    <span className={styles.step}>
      <span className={cx(styles.circle, styles[state])}>
        <Icon name={state === 'done' ? 'check' : icon} size={18} strokeWidth={state === 'done' ? 3 : 2} />
      </span>
      <span className={cx(styles.stepLabel, state === 'idle' && styles.stepIdle)}>{label}</span>
    </span>
  );
}

/** Full-screen verification (never a pop-up, PRD §8). Only the enabled steps are drawn. */
export function VerifyRun(p: VerifyRunProps) {
  const both = p.showLocationStep && p.showFaceStep;
  return (
    // One live region: with the live camera, its own status line announces the guidance.
    <div className={styles.run} aria-live={p.faceSlot ? undefined : 'polite'}>
      {both && (
        <div className={styles.stepper}>
          <Step state={p.locationState} icon="map-pin" label={p.labels.location} />
          <span className={cx(styles.connector, p.locationState === 'done' && styles.connectorDone)} />
          <Step state={p.faceState} icon="scan-face" label={p.labels.identity} />
        </div>
      )}
      {p.visual === 'location' ? (
        <span className={styles.locationVisual} aria-hidden="true">
          <span className={styles.pulse} />
          <span className={cx(styles.locationCircle, p.success && styles.locationOk)}>
            <Icon name={p.success ? 'check' : 'map-pin'} size={52} />
          </span>
        </span>
      ) : p.faceSlot ? (
        <div className={styles.faceSlot}>{p.faceSlot}</div>
      ) : (
        <span className={styles.faceVisual} aria-hidden="true">
          <Icon name="user" size={120} strokeWidth={1} className={styles.faceUser} />
          <span className={cx(styles.oval, p.success && styles.ovalOk)} />
        </span>
      )}
      <div className={styles.text}>
        <p className={styles.title}>{p.title}</p>
        <p className={styles.subtitle}>{p.subtitle}</p>
        {p.visual === 'face' && p.simulatedNote && (
          <p className={styles.simulatedNote}>
            <Icon name="info" size={16} />
            {p.simulatedNote}
          </p>
        )}
      </div>
    </div>
  );
}
