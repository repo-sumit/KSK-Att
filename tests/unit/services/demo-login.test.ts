// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoAdapters } from '@/demo/adapters';
import { PERSONAS } from '@/demo/personas';
import { createMockContainer } from '@/services/container';
import { DEFAULT_SIMULATION, StaticSimulationSource } from '@/services/simulation';
import { MemoryStore } from '@/lib/kv-store';
import { FixedClock, instantAt } from '@/lib/time';

beforeEach(() => localStorage.clear());

describe('demo credential autofill', () => {
  it('offers the credentials of the persona the presenter picked, and updates when it changes', () => {
    const demo = createDemoAdapters();
    expect(demo.loginAssist.get()).toMatchObject({ label: 'Use demo login', instituteCode: '27410', trainerId: 'TR-10432', who: 'Rajesh Patil · Open instructor' });
    let changes = 0;
    demo.loginAssist.subscribe(() => changes++);
    demo.repo.update((s) => ({ ...s, persona: 'principal' }));
    expect(demo.loginAssist.get()).toMatchObject({ trainerId: 'PR-2741', who: 'Dr. Anil Deshmukh · Principal' });
    expect(changes).toBe(1);
    // Stable identity while nothing changed (React external-store contract).
    expect(demo.loginAssist.get()).toBe(demo.loginAssist.get());
  });

  it.each(PERSONAS.map((p) => [p.id, p] as const))('%s: its demo credentials log in through the real auth service', async (_id, persona) => {
    const app = createMockContainer({
      store: new MemoryStore(),
      preferencesStore: new MemoryStore(),
      clock: new FixedClock(instantAt('2026-09-25', '10:15')),
      simulation: new StaticSimulationSource({ ...DEFAULT_SIMULATION, speed: 0 }),
    });
    const institute = await app.services.auth.lookupInstitute(persona.instituteCode);
    expect(institute.ok).toBe(true);
    if (!institute.ok) return;
    const who = await app.services.auth.lookupInstructor(institute.value.id, persona.trainerId);
    expect(who.ok && who.value).toMatchObject({ id: persona.staffId, name: persona.name });
  });

  it('production builds have no assist (nothing renders on the login screens)', () => {
    const app = createMockContainer({
      store: new MemoryStore(),
      preferencesStore: new MemoryStore(),
      clock: new FixedClock(instantAt('2026-09-25', '10:15')),
      simulation: new StaticSimulationSource(),
    });
    expect(app.services.loginAssist).toBeNull();
  });
});
