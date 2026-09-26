'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/icons/Icon';
import { useServices } from '@/hooks/services';
import type { LoginAssist } from '@/services/login-assist';
import styles from './Login.module.css';

const NO_SUBSCRIPTION = () => () => undefined;

interface LoginAssistButtonProps {
  readonly field: keyof Pick<LoginAssist, 'instituteCode' | 'trainerId'>;
  readonly onFill: (value: string) => void;
  /** The field to return focus to, so Enter (or Continue) is the obvious next step. */
  readonly inputId: string;
}

/**
 * One-tap prefill for a login field. Renders only when the container has a
 * LoginAssistSource (demo builds); fills the field and nothing else — the user
 * still presses Continue and sees every confirmation.
 */
export function LoginAssistButton({ field, onFill, inputId }: LoginAssistButtonProps) {
  const source = useServices().loginAssist;
  const subscribe = useMemo(() => (source ? (cb: () => void) => source.subscribe(cb) : NO_SUBSCRIPTION), [source]);
  const assist = useSyncExternalStore(subscribe, () => source?.get() ?? null, () => null);
  if (!assist) return null;
  return (
    <button
      type="button"
      className={styles.assist}
      lang="en"
      onClick={() => {
        onFill(assist[field]);
        document.getElementById(inputId)?.focus();
      }}
    >
      <Icon name="sliders" size={16} />
      <span className={styles.assistText}>
        <span className={styles.assistLabel}>{assist.label}</span>
        <span className={styles.assistWho}>{assist.who}</span>
      </span>
    </button>
  );
}
