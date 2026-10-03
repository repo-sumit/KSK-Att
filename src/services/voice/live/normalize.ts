/**
 * Flattens one Gemini Live server message into a LiveEvent. Processes EVERY part of EVERY message: one message can
 * carry several audio parts, transcripts, tool calls and a resumption update together (MVP-02 L850-L930).
 * Reads the message defensively (it is network data); a bad audio part is skipped, never thrown.
 */
import { base64ToInt16 } from '../audio/pcm';
import type { LiveEvent, LiveToolCall } from './transport';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null;
const asObj = (v: unknown): Obj | undefined => (isObj(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/** '9.5s' | { seconds, nanos } (seconds may be a string, protobuf int64) | number (seconds) → milliseconds. */
export function parseDurationMs(value: unknown): number | undefined {
  let seconds: number | undefined;
  if (typeof value === 'number') seconds = value;
  else if (typeof value === 'string') {
    const m = /^\s*(-?\d+(?:\.\d+)?)s\s*$/.exec(value);
    if (m) seconds = Number(m[1]);
  } else if (isObj(value)) {
    const s = value.seconds === undefined ? 0 : Number(value.seconds);
    const n = value.nanos === undefined ? 0 : Number(value.nanos);
    seconds = s + n / 1e9;
  }
  if (seconds === undefined || !Number.isFinite(seconds)) return undefined;
  return Math.round(Math.max(0, seconds) * 1000);
}

function audioParts(modelTurn: Obj | undefined): Int16Array[] {
  const out: Int16Array[] = [];
  const parts = modelTurn?.parts;
  if (!Array.isArray(parts)) return out;
  for (const part of parts) {
    const data = str(asObj(asObj(part)?.inlineData)?.data);
    if (!data) continue;
    try {
      out.push(base64ToInt16(data));
    } catch {
      // malformed base64: skip this part, keep the rest of the message
    }
  }
  return out;
}

function toolCalls(raw: unknown): LiveToolCall[] | undefined {
  const calls = asObj(raw)?.functionCalls;
  if (!Array.isArray(calls)) return undefined;
  const out: LiveToolCall[] = [];
  for (const c of calls) {
    const o = asObj(c);
    if (!o) continue;
    out.push({ id: str(o.id), name: typeof o.name === 'string' ? o.name : '', args: asObj(o.args) ?? {} });
  }
  return out;
}

export function normalizeMessage(msg: unknown): LiveEvent {
  const m = asObj(msg);
  const sc = asObj(m?.serverContent);
  const input = asObj(sc?.inputTranscription);
  const output = asObj(sc?.outputTranscription);
  const calls = toolCalls(m?.toolCall);
  const ids = asObj(m?.toolCallCancellation)?.ids;
  const update = asObj(m?.sessionResumptionUpdate);
  const goAwayMs = parseDurationMs(asObj(m?.goAway)?.timeLeft);
  const handle = str(update?.newHandle);
  const inputText = str(input?.text);
  const outputText = str(output?.text);
  const cancelled = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];

  return {
    audio: audioParts(asObj(sc?.modelTurn)),
    ...(inputText !== undefined ? { inputText } : {}),
    ...(input?.finished === true ? { inputFinished: true } : {}),
    ...(outputText !== undefined ? { outputText } : {}),
    ...(output?.finished === true ? { outputFinished: true } : {}),
    ...(sc?.interrupted === true ? { interrupted: true } : {}),
    ...(sc?.turnComplete === true ? { turnComplete: true } : {}),
    ...(sc?.generationComplete === true ? { generationComplete: true } : {}),
    ...(calls?.length ? { toolCalls: calls } : {}),
    ...(cancelled.length ? { cancelledIds: cancelled } : {}),
    ...(update ? { resumption: { ...(handle ? { handle } : {}), resumable: update.resumable === true } } : {}),
    ...(goAwayMs !== undefined ? { goAwayMs } : {}),
  };
}
