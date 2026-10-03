import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * The live-model harness (Task 20): scripted trainer turns against the real Gemini Live model, with the real executor
 * and the mock container. Not part of `npm test` (it costs quota and needs GEMINI_API_KEY): run `npm run test:voice-live`.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/voice-live/**/*.test.ts'],
    environment: 'node',
    reporters: ['verbose'], // the per-turn timeline (console.info) is the point of a live run; the default reporter may hide it
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
});
