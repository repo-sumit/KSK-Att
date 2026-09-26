'use client';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { IconWell } from '@/components/ui/IconWell';
import { Icon } from '@/components/ui/icons/Icon';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { useI18n } from '@/hooks/i18n';
import { routes } from '@/lib/routes';
import type { NavTab } from '@/config/journey';
import type { MessageParams } from '@/i18n/types';
import { PROBLEMS, type ProblemKind } from './problems';
import styles from './Feedback.module.css';

export interface FeedbackAction {
  readonly label: string;
  readonly onPress?: () => void;
  readonly href?: string;
}

interface ProblemScreenProps {
  readonly kind: ProblemKind;
  readonly params?: MessageParams;
  readonly primary?: FeedbackAction;
  readonly secondary?: FeedbackAction;
  /** Extra line under the body, e.g. the distance chip for geo-fence failures. */
  readonly chip?: ReactNode;
  readonly header?: ReactNode;
  /** Inside a signed-in flow: the area marked current in the header navigation. */
  readonly area?: NavTab;
}

/** "What happened" + "what to do" with one recovery action (prototype err screen). */
export function ProblemScreen({ kind, params, primary, secondary, chip, header, area }: ProblemScreenProps) {
  const { t } = useI18n();
  const p = PROBLEMS[kind];
  const main = primary ?? { label: t('problem.goHome'), href: routes.home };
  return (
    <ScreenLayout
      surface="default"
      header={header}
      area={area}
      // Inside a signed-in flow (with the app header) the problem sits in the page, its action right under
      // the message; on its own it is a card.
      card={!header}
      inlineFooter
      width="form"
      padding="center"
      footer={
        <>
          <Button fullWidth onClick={main.onPress} href={main.href}>
            {main.label}
          </Button>
          {secondary && (
            <Button variant="ghost" fullWidth onClick={secondary.onPress} href={secondary.href}>
              {secondary.label}
            </Button>
          )}
        </>
      }
    >
      <IconWell icon={p.icon} tone={p.tone} />
      <div className={styles.text}>
        <h1 className={styles.title}>{t(p.title, params)}</h1>
        <p className={styles.body}>{t(p.body, params)}</p>
      </div>
      {chip}
    </ScreenLayout>
  );
}

export function DistanceChip({ children }: { readonly children: ReactNode }) {
  return (
    <p className={styles.chip}>
      <Icon name="map-pin" size={20} />
      {children}
    </p>
  );
}
