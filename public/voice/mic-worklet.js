// AudioWorkletProcessor: mic Float32 -> PCM16 mono at 16 kHz, posted as ~40 ms chunks (640 samples).
// The AudioContext is created at 16 kHz, so the ratio is normally 1 (a straight conversion);
// otherwise this picks the nearest sample, which is fine for speech (Chrome is the demo target).
/* global AudioWorkletProcessor, registerProcessor, sampleRate */
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000; // sampleRate is a global inside the worklet scope
    this.out = new Int16Array(640); // 40 ms at 16 kHz
    this.n = 0;
    this.t = 0; // fractional read cursor carried across blocks
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    while (this.t < input.length) {
      const s = Math.max(-1, Math.min(1, input[Math.floor(this.t)]));
      this.out[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.out.length) {
        const chunk = this.out.buffer.slice(0);
        this.port.postMessage(chunk, [chunk]);
        this.n = 0;
      }
      this.t += this.ratio;
    }
    this.t -= input.length;
    return true;
  }
}

registerProcessor('mic-processor', MicProcessor);
