'use client';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { IconWell } from '@/components/ui/IconWell';
import type { IconName } from '@/components/ui/icons/Icon';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import type { NavTab } from '@/config/journey';
import styles from './Feedback.module.css';
import type { FeedbackAction } from './ProblemScreen';

interface ResultScreenProps {
  readonly tone: 'success' | 'warning';
  readonly icon: IconName;
  readonly title: string;
  readonly sub?: ReactNode;
  readonly meta?: ReactNode;
  readonly note?: ReactNode;
  readonly children?: ReactNode;
  readonly primary: FeedbackAction;
  /** Signed in: the app header (avatar top right), the result in the page instead of a card. */
  readonly header?: ReactNode;
  readonly area?: NavTab;
}

/** Restrained success state (prototype done screen): icon well, title, detail rows. No confetti. */
export function ResultScreen({ tone, icon, title, sub, meta, note, children, primary, header, area }: ResultScreenProps) {
  return (
    <ScreenLayout
      header={header}
      area={area}
      card={!header}
      inlineFooter={Boolean(header)}
      width="form"
      surface="default"
      padding="center"
      footer={
        <Button fullWidth onClick={primary.onPress} href={primary.href}>
          {primary.label}
        </Button>
      }
    >
      <IconWell icon={icon} tone={tone} settle />
      <div className={styles.text}>
        <h1 className={styles.resultTitle}>{title}</h1>
        {sub && <p className={styles.resultSub}>{sub}</p>}
        {meta && <p className={styles.body}>{meta}</p>}
      </div>
      {children}
      {note && <p className={styles.body}>{note}</p>}
    </ScreenLayout>
  );
}
