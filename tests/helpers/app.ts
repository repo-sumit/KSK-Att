/**
 * Shared test environment: a mock container on a fixed clock (Friday 2026-09-25, 10:15 IST) with instant
 * simulated pacing, plus the sign-in and verification steps most service tests start from.
 */
import { expect } from 'vitest';
import type { ConfigLayer } from '@/config/types';
import { MemoryStore } from '@/lib/kv-store';
import { FixedClock, instantAt } from '@/lib/time';
import { createMockContainer, type AppContainer } from '@/services/container';
import type { SessionContext } from '@/services/context';
import { DEFAULT_SIMULATION, StaticSimulationSource } from '@/services/simulation';
import { TODAY } from './fixtures';

export { TODAY };

export function setup(overrides: ConfigLayer = {}) {
  const clock = new FixedClock(instantAt(TODAY, '10:15'));
  const simulation = new StaticSimulationSource({ ...DEFAULT_SIMULATION, speed: 0 });
  let layer = overrides;
  const app = createMockContainer({ store: new MemoryStore(), preferencesStore: new MemoryStore(), clock, simulation, configOverrides: { get: () => layer } });
  app.services.sync.start();
  return { app, clock, simulation, setConfig: (l: ConfigLayer) => (layer = l) };
}

export async function signIn(app: AppContainer, trainerId: string): Promise<SessionContext> {
  const inst = await app.services.auth.lookupInstitute('27410');
  if (!inst.ok) throw new Error('institute');
  const who = await app.services.auth.lookupInstructor(inst.value.id, trainerId);
  if (!who.ok) throw new Error(`instructor ${trainerId}: ${who.error}`);
  await app.services.auth.startSession(inst.value.id, who.value.id);
  const ctx = await app.services.session.load();
  if (!ctx) throw new Error('session');
  return ctx;
}

export async function verify(app: AppContainer, ctx: SessionContext, key: string) {
  const loc = await app.services.verification.checkLocation(ctx);
  expect(loc.ok).toBe(true);
  await app.services.verification.grant(ctx, { kind: 'session', key }, loc.ok ? loc.value : undefined);
}
