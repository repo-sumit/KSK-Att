'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DetailRows } from '@/components/ui/DetailRows';
import { Section } from '@/components/ui/Section';
import { useToast } from '@/components/ui/Toast';
import { useI18n } from '@/hooks/i18n';
import { useSession } from '@/hooks/session';
import { routes } from '@/lib/routes';
import { micTestFailed, probeEnvironment, testMicrophone, testSpeaker } from '@/services/voice/audio/probes';
import { audioSupported } from '@/services/voice/audio/types';
import { formatDiagnostics, isAndroidWebView, type DiagnosticRow } from '@/services/voice/diagnostics';
import { AppHeader } from '../../shell/AppHeader';
import { DiagnosticList } from './DiagnosticList';
import styles from './VoiceDiagnostics.module.css';

interface Device {
  readonly userAgent: string;
  readonly supported: boolean;
  readonly rows: readonly DiagnosticRow[];
}

const never = () => () => undefined;
let read: Device | null = null;
/**
 * The environment checks, run once in the browser after the screen mounts (C11): React subscribes in an effect, and
 * the probes create and close two AudioContexts, a side effect that must not run while rendering. The snapshot
 * (below) only reads the cached result, so it stays pure; React reads it again after subscribing and re-renders.
 */
function probeOnMount(onChange: () => void): () => void {
  if (!read) {
    read = { userAgent: navigator.userAgent, supported: audioSupported(), rows: probeEnvironment() };
    onChange();
  }
  return () => undefined;
}
const cachedDevice = (): Device | null => read;

/**
 * Voice check (Task 20): a hidden screen for the person setting voice up on a phone. Environment checks run on
 * open; the microphone and the speaker run on a tap (the AudioContexts must be made inside the click). Copy report
 * puts the same readings, as plain text, on the clipboard for support. Nothing is recorded, stored or sent.
 */
export function VoiceDiagnostics() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const ctx = useSession();
  const enabled = ctx.journey.voice.enabled;
  const device = useSyncExternalStore(enabled ? probeOnMount : never, () => (enabled ? cachedDevice() : null), () => null);
  const [mic, setMic] = useState<readonly DiagnosticRow[]>([]);
  const [micBusy, setMicBusy] = useState(false);
  const [speaker, setSpeaker] = useState<readonly DiagnosticRow[]>([]);

  // A disabled feature is absent: an address typed by hand goes home.
  useEffect(() => {
    if (!enabled) router.replace(routes.home);
  }, [enabled, router]);

  if (!enabled) return null;
  const report = device ? formatDiagnostics({ userAgent: device.userAgent, rows: [...device.rows, ...mic, ...speaker] }) : '';
  const webView = device ? isAndroidWebView(device.userAgent) : false;

  // Both start straight from the tap: the probes create their AudioContexts before they wait for anything.
  const runMic = () => {
    if (micBusy) return;
    setMicBusy(true);
    // A rejected test (C13) still ends with a row and an enabled button.
    void testMicrophone()
      .then(setMic, (error: unknown) => setMic([micTestFailed(error)]))
      .finally(() => setMicBusy(false));
  };
  const runSpeaker = () => setSpeaker([testSpeaker()]);
  const copy = () => {
    const done = (ok: boolean) => toast.show(ok ? t('voice.diagnostics.copied') : t('voice.diagnostics.copyFailed'));
    try {
      void navigator.clipboard.writeText(report).then(() => done(true), () => done(false));
    } catch {
      done(false);
    }
  };

  return (
    <ScreenLayout width="reading" area="home" header={<AppHeader back="back" title={t('voice.diagnostics.title')} backHref={routes.home} />}>
      <p className={styles.intro}>{t('voice.diagnostics.intro')}</p>
      {device && (
        <>
          <Banner tone={device.supported ? 'success' : 'error'} icon={device.supported ? 'circle-check' : 'circle-x'} live>
            {t(device.supported ? 'voice.diagnostics.summaryOk' : 'voice.diagnostics.summaryNo')}
          </Banner>
          <Section title={t('voice.diagnostics.device')} variant="label">
            <Card>
              <DetailRows
                rows={[
                  { key: 'webView', label: t('voice.diagnostics.webView'), value: t(webView ? 'voice.diagnostics.yes' : 'voice.diagnostics.no') },
                  { key: 'userAgent', label: t('voice.diagnostics.userAgent'), value: <span className={styles.agent}>{device.userAgent}</span> },
                ]}
              />
            </Card>
          </Section>
          <Section title={t('voice.diagnostics.checks')} variant="label">
            <DiagnosticList rows={device.rows} label={t('voice.diagnostics.checks')} />
          </Section>
          <Section title={t('voice.diagnostics.microphone')} subtitle={t('voice.diagnostics.microphoneHint')} variant="label">
            <Button variant="secondary" leadingIcon="mic" loading={micBusy} onClick={runMic}>
              {t(micBusy ? 'voice.diagnostics.testingMic' : 'voice.diagnostics.testMic')}
            </Button>
            <DiagnosticList rows={mic} label={t('voice.diagnostics.microphone')} />
          </Section>
          <Section title={t('voice.diagnostics.speaker')} subtitle={t('voice.diagnostics.speakerHint')} variant="label">
            <Button variant="secondary" leadingIcon="headphones" onClick={runSpeaker}>
              {t('voice.diagnostics.testSpeaker')}
            </Button>
            <DiagnosticList rows={speaker} label={t('voice.diagnostics.speaker')} />
          </Section>
          <Section title={t('voice.diagnostics.report')} variant="label">
            <Button variant="primary" leadingIcon="clipboard-check" onClick={copy}>
              {t('voice.diagnostics.copy')}
            </Button>
            {/* The same text, selectable, for a WebView that refuses the clipboard. Plain English, for support. */}
            <pre className={styles.report} lang="en" tabIndex={0}>
              {report}
            </pre>
          </Section>
        </>
      )}
    </ScreenLayout>
  );
}
