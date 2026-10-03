import { describe, expect, it } from 'vitest';
import { formatDiagnostics, isAndroidWebView, type DiagnosticsResults } from '@/services/voice/diagnostics';

const WEBVIEW_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 5 Build/TQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36';
const CHROME_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

describe('isAndroidWebView', () => {
  it('finds "; wv)" in the user agent of an Android WebView only', () => {
    expect(isAndroidWebView(WEBVIEW_UA)).toBe(true);
    expect(isAndroidWebView(CHROME_UA)).toBe(false);
    expect(isAndroidWebView('')).toBe(false);
  });
});

describe('formatDiagnostics', () => {
  const results: DiagnosticsResults = {
    userAgent: WEBVIEW_UA,
    rows: [
      { id: 'secureContext', status: 'pass' },
      { id: 'getUserMedia', status: 'pass' },
      { id: 'audioWorklet', status: 'fail', detail: 'AudioWorklet is missing' },
      { id: 'rate16', status: 'pass', detail: '16000 Hz' },
      { id: 'micSettings', status: 'info', detail: 'echoCancellation=true, noiseSuppression=true, autoGainControl=true, sampleRate=48000, channelCount=1' },
    ],
  };

  it('writes plain text: the user agent, the WebView answer, then one line per row in order', () => {
    expect(formatDiagnostics(results).split('\n')).toEqual([
      'KSK voice diagnostics',
      `User agent: ${WEBVIEW_UA}`,
      'Android WebView: yes',
      '',
      '[PASS] Secure context',
      '[PASS] Microphone API (getUserMedia)',
      '[FAIL] AudioWorklet: AudioWorklet is missing',
      '[PASS] 16 kHz audio context: 16000 Hz',
      '[INFO] Microphone settings: echoCancellation=true, noiseSuppression=true, autoGainControl=true, sampleRate=48000, channelCount=1',
    ]);
  });

  it('says no for a browser that is not a WebView and stays valid with no rows', () => {
    const text = formatDiagnostics({ userAgent: CHROME_UA, rows: [] });
    expect(text).toContain('Android WebView: no');
    expect(text.endsWith('\n')).toBe(false);
  });

  it('keeps a multi-line or very long detail on one line and never prints an empty detail', () => {
    const text = formatDiagnostics({ userAgent: CHROME_UA, rows: [{ id: 'speaker', status: 'fail', detail: 'a\nb' }, { id: 'micLevel', status: 'pass', detail: '' }] });
    expect(text).toContain('[FAIL] Speaker tone: a b');
    expect(text).toContain('[PASS] Microphone level\n'.trimEnd());
    expect(text).not.toContain('Microphone level:');
  });
});
