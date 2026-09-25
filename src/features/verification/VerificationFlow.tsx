'use client';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Latin } from '@/components/ui/Latin';
import { useToast } from '@/components/ui/Toast';
import { InnerHeader } from '@/components/shell/Headers';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { PermissionPrimer } from '../feedback/PermissionPrimer';
import { DistanceChip, ProblemScreen } from '../feedback/ProblemScreen';
import { useVerification } from './useVerification';
import type { VerificationPurpose } from '@/services/verification';
import { VerifyRun } from './VerifyRun';

interface VerificationFlowProps {
  readonly purpose: VerificationPurpose;
  /** Header subtitle: the session being opened, or "My attendance". */
  readonly subtitle: ReactNode;
  readonly passedSubtitle: string;
  readonly onPassed: () => void;
  readonly onExit: () => void;
}

/** Renders the verification state machine: primers, the run screen, and each failure with its one remedy. */
export function VerificationFlow({ purpose, subtitle, passedSubtitle, onPassed, onExit }: VerificationFlowProps) {
  const { t, format } = useI18n();
  const toast = useToast();
  const ctx = useSession();
  const { face } = useServices();
  const flow = useVerification(purpose, onPassed);
  const { phase } = flow;
  const j = ctx.journey.verification;
  const help = { label: t('common.needHelp'), onPress: () => toast.show(t(ctx.journey.homeVariant === 'institute' ? 'common.helpToastPrincipal' : 'common.helpToast')) };
  const header = <InnerHeader title={t('verify.title')} subtitle={subtitle} back="close" onBack={onExit} />;

  if (phase.kind === 'primer')
    return <PermissionPrimer kind={phase.permission} onAllow={phase.permission === 'location' ? flow.allowLocation : flow.allowCamera} onNotNow={onExit} />;

  if (phase.kind === 'problem') {
    switch (phase.problem) {
      case 'outside':
        return (
          <ProblemScreen
            kind="outside"
            params={{ distance: format.distance(phase.distanceM ?? 0) }}
            chip={<DistanceChip>{t('problem.distanceChip', { distance: format.distance(phase.distanceM ?? 0), institute: ctx.institute.shortName })}</DistanceChip>}
            primary={{ label: t('problem.checkAgain'), onPress: flow.retry }}
            secondary={help}
            header={header}
          />
        );
      case 'locationDenied':
        return <ProblemScreen kind="locationDenied" primary={{ label: t('permission.allowLocation'), onPress: flow.allowLocation }} secondary={{ label: t('common.goBack'), onPress: onExit }} />;
      case 'cameraDeniedVerify':
        return <ProblemScreen kind="cameraDeniedVerify" primary={{ label: t('permission.allowCamera'), onPress: flow.allowCamera }} secondary={{ label: t('common.goBack'), onPress: onExit }} />;
      case 'faceLimit':
        return <ProblemScreen kind="faceLimit" primary={{ label: t('common.goBack'), onPress: onExit }} />;
      default:
        return <ProblemScreen kind={phase.problem} primary={{ label: t('common.tryAgain'), onPress: flow.retry }} secondary={help} header={header} />;
    }
  }

  if (phase.kind === 'confirm')
    return (
      <ScreenLayout surface="default" banner={false} header={header} padding="none" footer={<Button fullWidth onClick={flow.confirmLocation}>{t('common.continue')}</Button>}>
        <VerifyRun
          showLocationStep
          showFaceStep={j.face}
          locationState="done"
          faceState="idle"
          visual="location"
          success
          title={t('verify.confirmTitle', { institute: ctx.institute.shortName })}
          subtitle={t('verify.confirmBody', { distance: format.distance(phase.distanceM) })}
          labels={{ location: t('verify.stepLocation'), identity: t('verify.stepIdentity') }}
        />
      </ScreenLayout>
    );

  // Geo-tagging alone has no visible component (PRD §8.1): a neutral "getting ready" state while coordinates arrive.
  const faceVisual = phase.kind === 'facing' || phase.kind === 'faced';
  const locationDone = phase.kind !== 'starting' && phase.kind !== 'locating';
  const visibleLocation = j.location === 'fence';
  const text: [ReactNode, ReactNode] = (() => {
    switch (phase.kind) {
      case 'locating':
        return phase.visible && visibleLocation ? [t('verify.checkingLocation'), t('verify.stayHere')] : [t('verify.preparing'), ''];
      case 'located':
        return [t('verify.locationVerified'), <Latin key="inst">{ctx.institute.shortName}</Latin>];
      case 'facing':
        return [t('verify.lookAtCamera'), t('verify.lookHint')];
      case 'faced':
      case 'passed':
        return [t('verify.identityVerified'), passedSubtitle];
      default:
        return [t('verify.preparing'), ''];
    }
  })() as [ReactNode, ReactNode];

  return (
    <ScreenLayout surface="default" banner={false} header={header} padding="none">
      <VerifyRun
        showLocationStep={visibleLocation}
        showFaceStep={j.face}
        locationState={locationDone ? 'done' : 'active'}
        faceState={phase.kind === 'faced' || phase.kind === 'passed' ? 'done' : faceVisual ? 'active' : 'idle'}
        visual={faceVisual || (!visibleLocation && j.face) ? 'face' : 'location'}
        success={phase.kind === 'located' || phase.kind === 'faced' || phase.kind === 'passed'}
        title={text[0]}
        subtitle={text[1]}
        labels={{ location: t('verify.stepLocation'), identity: t('verify.stepIdentity') }}
        simulatedNote={face.simulated ? t('face.simulated') : undefined}
      />
    </ScreenLayout>
  );
}
