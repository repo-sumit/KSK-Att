import { cameraErrorFrom } from '../../camera/device-camera';
import type { MicError } from './types';

export interface Mic {
  stop(): void;
  setEnabled(on: boolean): void;
  /** 0..1 RMS of the latest chunk (0 while disabled). */
  level(): number;
}

type MicResult = { ok: true; mic: Mic } | { ok: false; error: MicError };

function rms(pcm: Int16Array): number {
  if (!pcm.length) return 0;
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
  return Math.min(1, Math.sqrt(sum / pcm.length) / 32768);
}

/**
 * Opens the microphone on an AudioContext that was created (and resumed) inside the click handler
 * at 16 kHz. Each 40 ms chunk arrives as PCM16 mono 16 kHz while the mic is enabled. onEnded fires
 * if the device goes away mid-session (earphones unplugged, permission revoked); stop() does not.
 */
export async function startMic(ctx: AudioContext, onChunk: (pcm: Int16Array) => void, onEnded: () => void): Promise<MicResult> {
  if (typeof globalThis.isSecureContext === 'boolean' && !globalThis.isSecureContext) return { ok: false, error: 'insecure' };
  if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
    return { ok: false, error: 'unsupported' };
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (error) {
    return { ok: false, error: cameraErrorFrom(error) };
  }
  // Every audio track can end (a device usually has one), and the caller hears about it once.
  let endedReported = false;
  const reportEnded = () => {
    if (endedReported) return;
    endedReported = true;
    onEnded();
  };
  for (const track of stream.getAudioTracks()) track.addEventListener('ended', reportEnded, { once: true });
  try {
    await ctx.audioWorklet.addModule('/voice/mic-worklet.js');
    const source = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, 'mic-processor');
    // Silent sink: the node must reach the destination for process() to keep running.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    let enabled = true;
    let level = 0;
    node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (!enabled) return;
      const pcm = new Int16Array(e.data);
      level = rms(pcm);
      onChunk(pcm);
    };
    source.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
    return {
      ok: true,
      mic: {
        stop() {
          node.port.onmessage = null;
          source.disconnect();
          node.disconnect();
          mute.disconnect();
          stream.getTracks().forEach((t) => t.stop());
        },
        setEnabled(on) {
          enabled = on;
          if (!on) level = 0;
        },
        level: () => level,
      },
    };
  } catch (error) {
    stream.getTracks().forEach((t) => t.stop());
    return { ok: false, error: cameraErrorFrom(error) };
  }
}
