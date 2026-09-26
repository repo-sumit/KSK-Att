'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/icons/Icon';
import { IconWell } from '@/components/ui/IconWell';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { routes, safeNext } from '@/lib/routes';
import type { CapturedFrame } from '@/services/face';
import { PermissionPrimer } from '../feedback/PermissionPrimer';
import { ProblemScreen } from '../feedback/ProblemScreen';
import type { ProblemKind } from '../feedback/problems';
import { ResultScreen } from '../feedback/ResultScreen';
import { CaptureView } from './CaptureView';
import { faceProblem, isCheckFailure } from './guidance';
import styles from './Face.module.css';

type Step =
  | { readonly kind: 'intro' }
  | { readonly kind: 'primer' }
  | { readonly kind: 'capture'; readonly attempt: number; readonly saving: boolean; readonly guided: boolean }
  | { readonly kind: 'problem'; readonly problem: ProblemKind }
  | { readonly kind: 'done' };

/**
 * One-time face registration (PRD §8.5): the real front camera takes three
 * photos (straight, left, right) guided by an on-device movement check.
 * Matching is SIMULATED: the photos are never stored or sent; only the fact
 * of registration is recorded (D-048).
 */
export function FaceEnrolScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const ctx = useSession();
  const { faceCapture, faceMatch } = useServices();
  const next = safeNext(useSearchParams().get('next'));
  const [step, setStep] = useState<Step>({ kind: 'intro' });
  const [attempts, setAttempts] = useState(0);
  /** Failed movement checks on this screen: after two, the next attempt takes the photos on a countdown. */
  const [checkFailures, setCheckFailures] = useState(0);

  const capture = () => {
    setAttempts((a) => a + 1);
    setStep({ kind: 'capture', attempt: attempts + 1, saving: false, guided: checkFailures >= 2 });
  };
  const start = async () => {
    // Only "prompt" needs the primer first; anything else opens the camera, which reports a real block itself.
    if ((await faceCapture.permission()) === 'prompt') return setStep({ kind: 'primer' });
    capture();
  };
  const save = async (frames: CapturedFrame[]) => {
    setStep((s) => (s.kind === 'capture' ? { ...s, saving: true } : s));
    const result = await faceMatch.enrol(ctx.user.id, frames);
    setStep(result.ok ? { kind: 'done' } : { kind: 'problem', problem: 'enrolFail' });
  };

  const later = { label: t('face.later'), onPress: () => router.replace(routes.home) };
  const note = faceCapture.source() === 'simulated' ? t('face.simulatedCamera') : faceMatch.simulated ? t('face.prototypeNote') : null;

  switch (step.kind) {
    case 'primer':
      // "Allow camera" opens the camera, which is what triggers the browser / phone prompt.
      return <PermissionPrimer kind="camera" purpose="enrol" onAllow={capture} onNotNow={() => setStep({ kind: 'intro' })} />;
    case 'capture':
      return (
        <CaptureView
          key={step.attempt}
          saving={step.saving}
          onDone={(frames) => void save(frames)}
          guided={step.guided}
          onFail={(error) => {
            if (isCheckFailure(error)) setCheckFailures((n) => n + 1);
            setStep({ kind: 'problem', problem: faceProblem(error, 'enrol') });
          }}
          onCancel={() => setStep({ kind: 'intro' })}
        />
      );
    case 'problem':
      return <ProblemScreen kind={step.problem} primary={{ label: t('common.tryAgain'), onPress: capture }} secondary={later} />;
    case 'done':
      return <ResultScreen tone="success" icon="circle-check" title={t('face.successTitle')} meta={t('face.successBody')} primary={{ label: t('common.continue'), onPress: () => router.replace(next) }} />;
    case 'intro':
      return (
        <ScreenLayout surface="default" banner={false} padding="center" card footer={<Button fullWidth onClick={() => void start()}>{t('face.start')}</Button>}>
          <IconWell icon="scan-face" tone="brand" size={96} />
          <div className={styles.introText}>
            <h1 className={styles.title}>{t('face.introTitle')}</h1>
            <p className={styles.body}>{t('face.introBody')}</p>
            {/* Straight under the explanation: what is real and what is simulated is read before Start. */}
            {note && (
              <p className={styles.introNote}>
                <Icon name="info" size={16} />
                {note}
              </p>
            )}
          </div>
          <ul className={styles.tips}>
            <li><Icon name="sun" size={20} />{t('face.tipLight')}</li>
            <li><Icon name="user" size={20} />{t('face.tipAlone')}</li>
            <li><Icon name="camera" size={20} />{t('face.tipTime')}</li>
          </ul>
        </ScreenLayout>
      );
  }
}
