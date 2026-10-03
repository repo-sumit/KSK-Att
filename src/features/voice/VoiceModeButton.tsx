'use client';
import { useId } from 'react';
import { Button } from '@/components/ui/Button';
import { InlineNote } from '@/components/ui/InlineNote';
import { useT } from '@/hooks/i18n';
import { useVoice } from '@/hooks/voice';
import styles from './VoiceModeButton.module.css';

/**
 * Voice mode on the instructor's Home, on the line above today's classes (voice design §9). Absent unless voice
 * exists for this session and this browser; inactive offline (voice needs the network) and while voice is on.
 * The tap starts voice synchronously, so the session can create its AudioContexts inside the click.
 */
export function VoiceModeButton() {
  const t = useT();
  const voice = useVoice();
  const hintId = useId();
  if (!voice.available) return null;
  const running = voice.state !== null && voice.state.status !== 'error';
  return (
    <div className={styles.line}>
      <Button
        variant="secondary"
        size="md"
        leadingIcon="mic"
        inactive={!voice.online || running}
        aria-describedby={hintId}
        onClick={(event) => {
          if (event.detail > 1) return; // a double tap starts voice once
          voice.start();
        }}
      >
        {t('voice.mode')}
      </Button>
      <InlineNote id={hintId} icon={voice.online ? 'info' : 'wifi-off'} className={styles.hint}>
        {voice.online ? t('voice.modeHint') : t('voice.unavailableOffline')}
      </InlineNote>
    </div>
  );
}
