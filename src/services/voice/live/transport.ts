/**
 * The seam between the voice session (Task 16) and the Gemini Live WebSocket. The real transport is `gemini.ts`
 * (loaded with import() only when a live session starts); demos and tests use `ScriptedLiveTransport`
 * (`src/services/simulated/voice.ts`). Pure TypeScript: no SDK import here, so the session never pulls the SDK in.
 */
import type { ToolDeclaration, ToolResult } from '../tools';

export interface LiveToken { readonly token: string; readonly apiVersion: string; readonly model: string; readonly expiresAt: string }
export interface LiveSetup {
  readonly model: string;
  readonly systemInstruction: string;
  readonly tools: readonly ToolDeclaration[];
  readonly voiceName: string;
  readonly resumeHandle?: string;
}
export interface LiveToolCall { readonly id?: string; readonly name: string; readonly args: Record<string, unknown> }

/** One server message, flattened: every part of the message is represented (MVP-02 L850-L930). */
export interface LiveEvent {
  readonly audio: readonly Int16Array[];
  readonly inputText?: string; readonly inputFinished?: boolean;
  readonly outputText?: string; readonly outputFinished?: boolean;
  readonly interrupted?: boolean; readonly turnComplete?: boolean; readonly generationComplete?: boolean;
  readonly toolCalls?: readonly LiveToolCall[]; readonly cancelledIds?: readonly string[];
  readonly resumption?: { readonly handle?: string; readonly resumable: boolean };
  readonly goAwayMs?: number;
}
export interface LiveCallbacks { onEvent(e: LiveEvent): void; onClose(code: number, reason: string): void }
export interface LiveToolResponse { readonly id?: string; readonly name: string; readonly result: ToolResult }

export interface LiveConnection {
  sendAudio(pcm: Int16Array): void;
  sendText(text: string): void;
  sendAudioStreamEnd(): void;
  /** One sendToolResponse for all of them, in the order given. */
  sendToolResponses(responses: readonly LiveToolResponse[]): void;
  /** Idempotent. After it, sends are dropped and `onClose` is not called for this close. */
  close(): void;
}

export interface LiveTransport {
  readonly needsToken: boolean;
  /** Resolves after setup completes; rejects on close-before-setup or after `timeoutMs` (default 10 000), closing a late socket. */
  connect(token: LiveToken | null, setup: LiveSetup, cb: LiveCallbacks, timeoutMs?: number): Promise<LiveConnection>;
}

/**
 * The LiveConnectConfig (SDK-agnostic object, enum values as strings). What is deliberately absent: thinkingConfig,
 * proactivity, enableAffectiveDialog, generationConfig, httpOptions, speechConfig.languageCode, and `transparent`
 * resumption (the SDK throws on it in Gemini Developer API mode).
 */
export function liveConfig(setup: LiveSetup): Record<string, unknown> {
  return {
    responseModalities: ['AUDIO'],
    systemInstruction: { parts: [{ text: setup.systemInstruction }] },
    tools: [{ functionDeclarations: [...setup.tools] }],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: setup.voiceName } } },
    realtimeInputConfig: {
      automaticActivityDetection: {
        startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
        endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
        prefixPaddingMs: 100,
        silenceDurationMs: 500,
      },
    },
    // Caps per-turn re-billing; every tool result restates the facts, so dropping old turns is safe. Strings in the SDK typings.
    contextWindowCompression: { triggerTokens: '25000', slidingWindow: { targetTokens: '8000' } },
    sessionResumption: setup.resumeHandle ? { handle: setup.resumeHandle } : {},
  };
}
