'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/icons/Icon';
import { IconWell } from '@/components/ui/IconWell';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { routes, safeNext } from '@/lib/routes';
import type { CaptureGuidance, EnrolmentError } from '@/services/face';
import { PermissionPrimer } from '../feedback/PermissionPrimer';
import { ProblemScreen } from '../feedback/ProblemScreen';
import { ResultScreen } from '../feedback/ResultScreen';
import { CaptureView } from './CaptureView';
import styles from './Face.module.css';

type Step =
  | { readonly kind: 'intro' }
  | { readonly kind: 'primer' }
  | { readonly kind: 'capture'; readonly step: number; readonly guidance: CaptureGuidance }
  | { readonly kind: 'error'; readonly error: EnrolmentError }
  | { readonly kind: 'done' };

/**
 * One-time face registration (PRD §8.5). SIMULATION ONLY: no photo is taken or
 * stored — the screen and state machine are real, the recognition is not.
 */
export function FaceEnrolScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const ctx = useSession();
  const { face } = useServices();
  const next = safeNext(useSearchParams().get('next'));
  const [step, setStep] = useState<Step>({ kind: 'intro' });
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const capture = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setStep({ kind: 'capture', step: 1, guidance: 'find_face' });
    const result = await face.enrol(
      ctx.user.id,
      {
        onGuidance: (s, guidance) => !controller.signal.aborted && setStep({ kind: 'capture', step: s, guidance }),
        onStepComplete: () => undefined,
      },
      controller.signal,
    );
    if (controller.signal.aborted) return;
    setStep(result.ok ? { kind: 'done' } : { kind: 'error', error: result.error });
  };

  const start = async () => {
    if ((await face.cameraPermission()) === 'granted') return capture();
    setStep({ kind: 'primer' });
  };

  const later = { label: t('face.later'), onPress: () => router.replace(routes.home) };
  const retry = { label: t('common.tryAgain'), onPress: () => void capture() };

  switch (step.kind) {
    case 'primer':
      return (
        <PermissionPrimer
          kind="camera"
          purpose="enrol"
          onAllow={async () => ((await face.requestCameraPermission()) === 'granted' ? capture() : setStep({ kind: 'error', error: 'camera_denied' }))}
          onNotNow={() => setStep({ kind: 'intro' })}
        />
      );
    case 'capture':
      return <CaptureView step={step.step} total={face.requiredCaptures} guidance={step.guidance} simulatedNote={face.simulated ? t('face.simulated') : undefined} onCancel={() => { abort.current?.abort(); setStep({ kind: 'intro' }); }} />;
    case 'error':
      if (step.error === 'camera_denied')
        return <ProblemScreen kind="cameraDeniedEnrol" primary={{ label: t('permission.allowCamera'), onPress: () => setStep({ kind: 'primer' }) }} secondary={later} />;
      return <ProblemScreen kind={step.error === 'poor_light' ? 'light' : step.error === 'multiple_faces' ? 'multi' : 'enrolFail'} primary={retry} secondary={later} />;
    case 'done':
      return <ResultScreen tone="success" icon="circle-check" title={t('face.successTitle')} meta={t('face.successBody')} primary={{ label: t('common.continue'), onPress: () => router.replace(next) }} />;
    case 'intro':
      return (
        <ScreenLayout surface="default" banner={false} padding="center" footer={<Button fullWidth onClick={() => void start()}>{t('face.start')}</Button>}>
          <IconWell icon="scan-face" tone="brand" size={96} />
          <div className={styles.introText}>
            <h1 className={styles.title}>{t('face.introTitle')}</h1>
            <p className={styles.body}>{t('face.introBody')}</p>
          </div>
          <ul className={styles.tips}>
            <li><Icon name="sun" size={20} />{t('face.tipLight')}</li>
            <li><Icon name="user" size={20} />{t('face.tipAlone')}</li>
            <li><Icon name="camera" size={20} />{t('face.tipTime')}</li>
            <li className={styles.simulated}><Icon name="info" size={20} />{t('face.simulated')}</li>
          </ul>
        </ScreenLayout>
      );
  }
}
