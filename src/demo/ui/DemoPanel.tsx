'use client';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/icons/Icon';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSessionState } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { cx } from '@/lib/cx';
import type { DemoAdapters } from '../adapters';
import type { DemoController } from '../controller';
import { PERSONAS } from '../personas';
import { PRESETS } from '../presets';
import { Choice, DemoSettings } from './DemoSettings';
import { useDemoState } from './useDemoState';
import styles from './DemoPanel.module.css';

/**
 * DEMO ONLY — presenter controls. Never part of the instructor product (English only on purpose).
 * Order follows how a demo is run: pick a story (presets), or pick who logs in
 * (quick login); everything else waits under Advanced.
 */
export function DemoPanel({ demo, controller, onDone }: { readonly demo: DemoAdapters; readonly controller: DemoController; readonly onDone?: () => void }) {
  const state = useDemoState(demo);
  const { state: session } = useSessionState();
  const { configuration, faceMatch } = useServices();
  const { language } = useI18n();
  const ctx = session.status === 'ready' ? session.ctx : null;
  const config = ctx?.config ?? configuration.base();
  const signedIn = PERSONAS.find((p) => p.staffId === ctx?.user.id);
  const [confirmReset, setConfirmReset] = useState(false);
  const { data: enrolled } = useQuery(`demo-face:${ctx?.user.id}`, () => (ctx ? faceMatch.isEnrolled(ctx.user.id) : Promise.resolve(true)), ['face']);
  const run = (p: Promise<void> | void) => {
    void Promise.resolve(p).then(() => onDone?.());
  };

  return (
    <div className={styles.panel} lang="en">
      <div className={styles.head}>
        <Badge tone="warning">DEMO — not part of the product</Badge>
        <p className={styles.state}>
          {signedIn ? `${signedIn.title} · ` : 'Signed out · '}
          {state.simulation.online ? 'Online' : 'Offline'} · {language === 'mr' ? 'मराठी' : 'English'}
        </p>
      </div>

      <section className={styles.section} aria-labelledby="demo-presets">
        <h3 id="demo-presets" className={styles.sectionTitle}>Quick presets</h3>
        <div className={styles.presets}>
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className={cx(styles.preset, state.presetId === p.id && styles.active)} aria-pressed={state.presetId === p.id} onClick={() => run(controller.applyPreset(p.id))}>
              <span className={styles.presetTitle}>{p.title}</span>
              <span className={styles.presetLine}>{p.line}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="demo-login">
        <h3 id="demo-login" className={styles.sectionTitle}>Quick login</h3>
        <p className={styles.hint}>
          {state.skipLogin
            ? 'Signs straight in as this person (Skip login is on under Advanced).'
            : 'Opens the login screens. Pick this person under "Use demo account" there (or type the Trainer ID shown here): nothing is filled until you do.'}
        </p>
        <ul className={styles.personas}>
          {PERSONAS.map((p) => (
            <li key={p.id}>
              <button type="button" className={cx(styles.persona, state.persona === p.id && styles.active)} onClick={() => run(controller.quickLogin(p.id))}>
                <span className={styles.personaText}>
                  <span className={styles.presetTitle}>{p.title}</span>
                  <span className={styles.presetLine}>
                    {p.name} · {p.trainerId}
                  </span>
                </span>
                <Icon name={state.skipLogin ? 'log-in' : 'arrow-right'} size={18} className={styles.personaIcon} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <details className={styles.advanced}>
        <summary className={styles.summary}>
          <span>Advanced</span>
          <Icon name="chevron-down" size={20} className={styles.summaryIcon} />
        </summary>
        <div className={styles.advancedBody}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Login</h3>
            <Choice label="Skip login screens" value={state.skipLogin ? 'on' : 'off'} options={[['off', 'Off'], ['on', 'On']]} onChange={(v) => controller.setSkipLogin(v === 'on')} />
          </section>
          <DemoSettings config={config} state={state} controller={controller} faceEnrolled={enrolled ?? true} language={language} />
        </div>
      </details>

      <section className={styles.section}>
        {confirmReset ? (
          <div className={styles.confirm}>
            <p className={styles.hint}>Restore all demo data, records, corrections, face enrolment, queue and settings?</p>
            <Button variant="destructive" size="md" fullWidth leadingIcon="rotate-ccw" onClick={() => controller.reset()}>
              Reset everything
            </Button>
            <Button variant="secondary" size="md" fullWidth onClick={() => setConfirmReset(false)}>
              Keep demo
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="md" fullWidth leadingIcon="rotate-ccw" onClick={() => setConfirmReset(true)}>
            Reset demo
          </Button>
        )}
        <p className={styles.hint}>Configuration changes start a new session: verification runs again.</p>
      </section>
    </div>
  );
}
