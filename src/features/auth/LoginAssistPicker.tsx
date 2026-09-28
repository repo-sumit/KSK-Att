'use client';
import { useId, useMemo, useRef, useState, useSyncExternalStore, type TransitionEvent } from 'react';
import { Icon } from '@/components/ui/icons/Icon';
import { useServices } from '@/hooks/services';
import type { LoginAssistSource, LoginCredentials } from '@/services/login-assist';
import { useLoginFlow } from './LoginFlow';
import styles from './LoginAssist.module.css';

type Field = keyof Pick<LoginCredentials, 'instituteCode' | 'trainerId'>;

const NO_SUBSCRIPTION = () => () => undefined;

function useLoginAssist(source: LoginAssistSource | null) {
  const subscribe = useMemo(() => (source ? (cb: () => void) => source.subscribe(cb) : NO_SUBSCRIPTION), [source]);
  return useSyncExternalStore(subscribe, () => source?.get() ?? null, () => null);
}

/**
 * The account picked from the login assist earlier in this attempt, for one
 * field: its value (to prefill a later step on arrival) and `edited`, which
 * forgets the pick once the user types something else, so the confirmation
 * line never names an account whose value is no longer in the field.
 */
export function useAssistAccountValue(field: Field) {
  const source = useServices().loginAssist;
  const flow = useLoginFlow();
  const value = (flow.assistAccount && source?.credentials(flow.assistAccount)?.[field]) || null;
  return {
    value,
    edited: (next: string) => {
      if (value !== null && next !== value) flow.setAssistAccount(null);
    },
  };
}

interface LoginAssistPickerProps {
  readonly field: Field;
  /** The field that receives the value. It gets focus, so Enter (or Continue) is the obvious next step. */
  readonly inputId: string;
  readonly onFill: (value: string) => void;
}

/**
 * Pick an account to fill a login field. Renders only when the container has a
 * LoginAssistSource (demo builds); all its text comes from that source. It
 * fills the field and nothing else: the user still presses Continue and sees
 * every confirmation.
 */
export function LoginAssistPicker({ field, inputId, onFill }: LoginAssistPickerProps) {
  const source = useServices().loginAssist;
  const assist = useLoginAssist(source);
  const flow = useLoginFlow();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const chosenId = useId();
  if (!source || !assist) return null;

  const chosen = flow.assistAccount ? source.credentials(flow.assistAccount) : null;
  const highlighted = flow.assistAccount ?? assist.suggested;
  const toggle = () => setOpen((o) => !o);

  const choose = async (id: string) => {
    const credentials = await source.choose(id);
    if (!credentials) return;
    flow.setAssistAccount(id);
    onFill(credentials[field]);
    setOpen(false);
    document.getElementById(inputId)?.focus();
  };

  // The list grows in place; once it has, bring all of it into view (short phones).
  const revealed = (e: TransitionEvent<HTMLDivElement>) => {
    if (open && e.target === e.currentTarget && e.propertyName === 'grid-template-rows') root.current?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <div ref={root} className={styles.assist} lang="en">
      {chosen ? (
        <div className={styles.chosen}>
          <Icon name="sliders" size={16} className={styles.icon} />
          <p id={chosenId} className={styles.chosenText}>
            {assist.chosenLabel}: {chosen.who}
          </p>
          <button type="button" className={styles.change} aria-expanded={open} aria-controls={listId} aria-describedby={chosenId} onClick={toggle}>
            {assist.changeLabel}
          </button>
        </div>
      ) : (
        <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={listId} onClick={toggle}>
          <Icon name="sliders" size={16} className={styles.icon} />
          <span className={styles.toggleLabel}>{assist.label}</span>
          <Icon name="chevron-down" size={16} className={styles.chevron} />
        </button>
      )}
      <div className={styles.region} data-open={open} inert={!open} onTransitionEnd={revealed}>
        <div className={styles.clip}>
          <ul id={listId} className={styles.options} aria-label={assist.label}>
            {assist.options.map((o) => (
              <li key={o.id}>
                <button type="button" className={styles.option} aria-current={o.id === highlighted || undefined} onClick={() => void choose(o.id)}>
                  <span className={styles.optionText}>
                    {/* The space keeps the accessible name "Principal Dr. Anil Deshmukh" (a flex column doesn't render it). */}
                    <span className={styles.optionLabel}>{o.label}</span>{' '}
                    <span className={styles.optionWho}>{o.who}</span>
                  </span>
                  {/* The panel's suggestion is only highlighted; the check means "this is the account in the fields". */}
                  {o.id === flow.assistAccount && <Icon name="check" size={16} className={styles.icon} />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
