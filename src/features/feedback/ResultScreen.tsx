'use client';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { IconWell } from '@/components/ui/IconWell';
import type { IconName } from '@/components/ui/icons/Icon';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
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
}

/** Restrained success state (prototype done screen): icon well, title, detail rows. No confetti. */
export function ResultScreen({ tone, icon, title, sub, meta, note, children, primary }: ResultScreenProps) {
  return (
    <ScreenLayout
      surface="default"
      padding="center"
      footer={
        <Button fullWidth onClick={primary.onPress} href={primary.href}>
          {primary.label}
        </Button>
      }
    >
      <IconWell icon={icon} tone={tone} />
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
