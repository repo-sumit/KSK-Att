/**
 * The real Live transport on @google/genai. Reachable ONLY through import() (the voice service loads it when a live
 * session starts), so the SDK stays out of the first-load bundle. Never logs the token, the URL, audio or names.
 */
import { GoogleGenAI, type LiveConnectConfig, type Session } from '@google/genai';
import { int16ToBase64 } from '../audio/pcm';
import { normalizeMessage } from './normalize';
import {
  liveConfig,
  type LiveCallbacks,
  type LiveConnection,
  type LiveSetup,
  type LiveToken,
  type LiveToolResponse,
  type LiveTransport,
} from './transport';

const CONNECT_TIMEOUT_MS = 10_000;
const AUDIO_MIME = 'audio/pcm;rate=16000';

class GeminiConnection implements LiveConnection {
  closed = false;
  constructor(private readonly session: Session) {}

  sendAudio(pcm: Int16Array): void {
    if (this.closed) return;
    this.session.sendRealtimeInput({ audio: { data: int16ToBase64(pcm), mimeType: AUDIO_MIME } });
  }
  sendText(text: string): void {
    if (this.closed) return;
    this.session.sendRealtimeInput({ text });
  }
  sendAudioStreamEnd(): void {
    if (this.closed) return;
    this.session.sendRealtimeInput({ audioStreamEnd: true });
  }
  sendToolResponses(responses: readonly LiveToolResponse[]): void {
    if (this.closed) return;
    // `id` is always an own key: the SDK throws without the key in Gemini API mode (undefined is fine).
    this.session.sendToolResponse({
      functionResponses: responses.map((r) => ({ id: r.id, name: r.name, response: { output: r.result } })),
    });
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.session.close();
  }
}

/**
 * Port of MVP-02 `connect` (L674-L735). In SDK 2.26 `live.connect()` resolves after setupComplete but never rejects
 * when setup fails (the socket closes instead), so it is raced against the first close and a timer started after the
 * call. A socket that resolves after the race was lost is closed.
 */
async function connect(token: LiveToken | null, setup: LiveSetup, cb: LiveCallbacks, timeoutMs = CONNECT_TIMEOUT_MS): Promise<LiveConnection> {
  if (!token) throw new Error('A live token is required');
  const ai = new GoogleGenAI({ apiKey: token.token, httpOptions: { apiVersion: token.apiVersion } });

  return new Promise<LiveConnection>((resolve, reject) => {
    let settled = false;
    let conn: GeminiConnection | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    ai.live
      .connect({
        // The token is locked to the server's model (VOICE_MODEL): connect with it, so a model change on the server
        // alone cannot break every connect; the setup's copy is only the fallback.
        model: token.model || setup.model,
        config: liveConfig(setup) as LiveConnectConfig,
        callbacks: {
          // Messages queued during setup arrive before connect() resolves; a socket whose attempt failed is ignored.
          onmessage: (msg) => {
            if (conn?.closed || (settled && !conn)) return;
            cb.onEvent(normalizeMessage(msg));
          },
          onerror: () => undefined, // onclose follows with the code
          onclose: (e) => {
            const code = e?.code ?? 1006;
            const reason = e?.reason ?? '';
            if (!settled) {
              settle(() => reject(new Error(`Live socket closed before setup completed (code ${code})`)));
              return;
            }
            if (!conn || conn.closed) return; // a failed attempt, or a close we asked for
            conn.closed = true; // sends after a server close are dropped
            cb.onClose(code, reason);
          },
        },
      })
      .then(
        (session) => {
          if (settled) {
            session.close(); // the race was lost: do not leave a socket open
            return;
          }
          conn = new GeminiConnection(session);
          settle(() => resolve(conn as GeminiConnection));
        },
        (e: unknown) => settle(() => reject(e instanceof Error ? e : new Error('Live connect failed'))),
      );

    if (!settled) {
      timer = setTimeout(
        () => settle(() => reject(new Error(`No setupComplete within ${timeoutMs / 1000} s`))),
        timeoutMs,
      );
    }
  });
}

export const geminiTransport: LiveTransport = { needsToken: true, connect };
