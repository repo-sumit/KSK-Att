'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/icons/Icon';
import { StatusLine } from '@/components/ui/StatusLine';
import { useI18n } from '@/hooks/i18n';
import { useVoice } from '@/hooks/voice';
import { cx } from '@/lib/cx';
import type { Caption } from '@/services/voice/session';
import { CaptionLine, dockStatus, ErrorLine, Hint, HoldToTalk, LevelBar, lastCaptions, StatusText, useRoomy } from './VoiceDockParts';
import styles from './VoiceDock.module.css';

/**
 * The voice dock (voice design §9): inside every ScreenLayout's dock while Voice mode is on, above the footer and
 * the bottom navigation, so it never covers a row. One compact row (status, mic level, Use screen or Resume,
 * Stop voice) and one line (the error, the latest caption, or the privacy line); the second caption, push-to-talk
 * and the hints join it on taller screens or when the trainer opens the dock (with push-to-talk on, Hold to talk
 * stays in the closed row instead of Use screen). Each screen renders its own ScreenLayout, so the dock re-mounts
 * on every route: everything it shows comes from the voice provider.
 * A modal sheet (showModal) makes it inert while open; voice keeps running.
 */
export function VoiceDock() {
  const voice = useVoice();
  const { t } = useI18n();
  const roomy = useRoomy();
  const [expanded, setExpanded] = useState(false);
  const state = voice.state;
  if (!state) return null;

  const { status, error } = state;
  const streaming = status === 'listening' || status === 'speaking';
  const live = streaming || status === 'paused';
  const more = roomy || expanded;
  // With push-to-talk on, the mic opens only while Hold to talk is held, so the closed dock on a small screen must
  // still offer it: it takes Use screen's place in the row (Use screen is one tap away in the opened dock). The
  // dock re-mounts closed on every route, so without this the trainer would lose the only way to speak.
  const holdInRow = !more && streaming && state.pushToTalk;
  const { latest, other } = lastCaptions(state.captions);
  const lines = (more ? [other, latest] : [latest]).filter((c): c is Caption => c !== undefined);
  const fresh = !error && state.captions.length === 0;
  const who = (c: Caption) => t(c.who === 'trainer' ? 'voice.you' : 'voice.agent');
  const look = dockStatus(state);
  const statusText = t(look.key);
  // Under three minutes the warning must reach every screen: the closed compact row has no panel, so it takes the caption line's place.
  const lowTime = live && state.minutesLeft > 0 && state.minutesLeft < 3 ? t('voice.minutesLeft', { count: state.minutesLeft }) : null;
  const compactWarning = !more && !error && lowTime !== null;
  // The mic level means something only while the mic streams.
  const level = streaming ? <LevelBar level={state.level} /> : null;

  return (
    <section className={cx(styles.dock, error && styles.withError)} aria-label={t('voice.mode')} data-voice-status={status}>
      <div className={styles.row}>
        {roomy ? (
          <div className={styles.state}>
            <StatusText look={look} text={statusText} />
            {level}
          </div>
        ) : (
          <button type="button" className={cx(styles.state, styles.toggle)} aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
            <span className={styles.toggleLine}>
              <StatusText look={look} text={statusText} />
              <Icon name={expanded ? 'chevron-down' : 'chevron-up'} size={16} className={styles.chevron} />
            </span>
            {level}
            <span className="visually-hidden">{t('voice.moreControls')}</span>
          </button>
        )}
        <div className={styles.actions}>
          {state.canReconnect && (
            <Button size="md" onClick={voice.reconnect}>
              {t('voice.reconnect')}
            </Button>
          )}
          {holdInRow && <HoldToTalk label={t('voice.holdToTalk')} talking={state.talking} talk={voice.talk} inRow />}
          {streaming && !holdInRow && (
            <Button variant="secondary" size="md" onClick={voice.pause}>
              {t('voice.useScreen')}
            </Button>
          )}
          {status === 'paused' && (
            <Button variant="secondary" size="md" onClick={voice.resume}>
              {t('voice.resume')}
            </Button>
          )}
          <Button variant="secondary" size="md" leadingIcon="square" className={styles.stop} onClick={voice.stop}>
            <span className={styles.stopLabel}>{t('voice.stop')}</span>
          </Button>
        </div>
      </div>

      {error && <ErrorLine code={error} text={t(`voice.error.${error}`)} />}
      {compactWarning && (
        <StatusLine tone="warning" icon="clock" nowrap>
          {lowTime}
        </StatusLine>
      )}
      {!error && !compactWarning && lines.map((c, i) => <CaptionLine key={`${i}-${c.who}`} caption={c} who={who(c)} />)}
      {fresh && !more && !compactWarning && (
        <Hint icon="info" compact>
          {t('voice.privacy')}
        </Hint>
      )}

      {more && (
        <div className={styles.more}>
          {lowTime && (
            <StatusLine tone="warning" icon="clock">
              {lowTime}
            </StatusLine>
          )}
          {fresh && <Hint icon="headphones">{t('voice.earphones')}</Hint>}
          {fresh && <Hint icon="info">{t('voice.privacy')}</Hint>}
          {status !== 'error' && (
            <div className={styles.ptt}>
              <Button variant="secondary" size="md" aria-pressed={state.pushToTalk} onClick={() => voice.setPushToTalk(!state.pushToTalk)}>
                {t('voice.pushToTalk')}
              </Button>
              {state.pushToTalk && <HoldToTalk label={t('voice.holdToTalk')} talking={state.talking} talk={voice.talk} />}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
