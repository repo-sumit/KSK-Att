const RATE = 24000; // Live API audio out: PCM16 mono 24 kHz

/**
 * Gapless queue for the model's audio on a 24 kHz AudioContext that the caller created and resumed
 * inside the click handler (autoplay rule). The caller owns the context: close() only flushes.
 */
export class PcmPlayer {
  private next = 0;
  private sources = new Set<AudioBufferSourceNode>();

  constructor(private readonly ctx: AudioContext) {}

  play(pcm: Int16Array): void {
    if (!pcm.length) return;
    const buf = this.ctx.createBuffer(1, pcm.length, RATE);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    // Small lead only when the queue has run dry, so the first chunk is not clipped; otherwise
    // the chunk goes straight after the one already queued (no inserted gap).
    if (this.next < this.ctx.currentTime) this.next = this.ctx.currentTime + 0.05;
    src.start(this.next);
    this.next += buf.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  /** Stop all queued audio now (the trainer barged in). */
  flush(): void {
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    this.sources.clear();
    this.next = 0;
  }

  isPlaying(): boolean {
    return this.sources.size > 0;
  }

  close(): void {
    this.flush();
  }
}
