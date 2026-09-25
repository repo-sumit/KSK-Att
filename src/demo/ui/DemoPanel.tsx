'use client';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSessionState } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { cx } from '@/lib/cx';
import type { DemoAdapters } from '../adapters';
import type { DemoController } from '../controller';
import { PERSONAS, type DemoRole } from '../personas';
import { PRESETS } from '../presets';
import { DemoSettings } from './DemoSettings';
import { useDemoState } from './useDemoState';
import styles from './DemoPanel.module.css';

/** DEMO ONLY — presenter controls. Never part of the instructor product (English only on purpose). */
export function DemoPanel({ demo, controller, onDone }: { readonly demo: DemoAdapters; readonly controller: DemoController; readonly onDone?: () => void }) {
  const state = useDemoState(demo);
  const { state: session } = useSessionState();
  const { configuration, face } = useServices();
  const { language } = useI18n();
  const ctx = session.status === 'ready' ? session.ctx : null;
  const config = ctx?.config ?? configuration.base();
  const current = PERSONAS.find((p) => p.staffId === ctx?.user.id);
  const [role, setRole] = useState<DemoRole>(current?.role ?? 'instructor');
  const [confirmReset, setConfirmReset] = useState(false);
  const { data: enrolled } = useQuery(`demo-face:${ctx?.user.id}`, () => (ctx ? face.isEnrolled(ctx.user.id) : Promise.resolve(true)), ['face']);
  const run = (p: Promise<void> | void) => {
    void Promise.resolve(p).then(() => onDone?.());
  };

  return (
    <div className={styles.panel} lang="en">
      <div className={styles.head}>
        <p className={styles.title}>Demo controls</p>
        <Badge tone="warning">DEMO — not part of the product</Badge>
        <p className={styles.state}>
          {current ? `${current.title} · ` : 'Signed out · '}
          {state.simulation.online ? 'Online' : 'Offline'} · {language === 'mr' ? 'मराठी' : 'English'}
        </p>
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Quick presets</h3>
        <div className={styles.presets}>
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className={cx(styles.preset, state.presetId === p.id && styles.active)} onClick={() => run(controller.applyPreset(p.id))}>
              <span className={styles.presetTitle}>{p.title}</span>
              <span className={styles.presetLine}>{p.line}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Role &amp; persona</h3>
        <Segmented
          label="Role"
          size="sm"
          fullWidth
          value={role}
          onChange={setRole}
          options={[
            { value: 'instructor', label: 'Instructor' },
            { value: 'group_instructor', label: 'Group instr.' },
            { value: 'principal', label: 'Principal' },
          ]}
        />
        <ul className={styles.personas}>
          {PERSONAS.filter((p) => p.role === role).map((p) => (
            <li key={p.id}>
              <button type="button" className={cx(styles.persona, current?.id === p.id && styles.active)} onClick={() => run(controller.signInAs(p.id))}>
                <span className={styles.presetTitle}>{p.title}</span>
                <span className={styles.presetLine}>
                  {p.line} · {p.trainerId}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.hint}>Login: institute code 27410, then a Trainer ID above.</p>
      </section>

      <DemoSettings config={config} state={state} controller={controller} faceEnrolled={enrolled ?? true} language={language} />

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
