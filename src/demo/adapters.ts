/**
 * DEMO ONLY — the single entry point the app imports (behind
 * NEXT_PUBLIC_DEMO_MODE). Turns DemoState into the interfaces the core already
 * accepts: a Clock, a SimulationSource and a ConfigOverridesSource.
 */
import type { ConfigLayer } from '@/config/types';
import type { ConfigOverridesSource } from '@/services/configuration';
import type { LoginAssist, LoginAssistSource } from '@/services/login-assist';
import type { SimulationSource, SimulationState } from '@/services/simulation';
import { createDefaultStore } from '@/lib/kv-store';
import { instantAt, toLocalDate, type Clock } from '@/lib/time';
import { DemoStateRepository } from './store';
import { personaById, personaForStaff } from './personas';
import { mergeConfigLayer } from '@/config/resolve';

/** Sentinel checked by scripts/check-demo-stripped.mjs: must not appear in a non-demo build. */
export const DEMO_SENTINEL = '__KSK_DEMO__';

export class DemoClock implements Clock {
  constructor(private readonly repo: DemoStateRepository) {}
  now(): Date {
    const setting = this.repo.get().clock;
    const real = new Date();
    return setting.mode === 'real' ? real : instantAt(toLocalDate(real), setting.time);
  }
}

class DemoSimulationSource implements SimulationSource {
  constructor(private readonly repo: DemoStateRepository) {}
  get(): SimulationState {
    return this.repo.get().simulation;
  }
  update(patch: Partial<SimulationState>): void {
    this.repo.update((s) => ({ ...s, simulation: { ...s.simulation, ...patch } }));
  }
  subscribe(listener: () => void) {
    return this.repo.subscribe(listener);
  }
}

/** Persona patch first (who is signed in), then the presenter's explicit panel changes on top. */
class DemoConfigOverrides implements ConfigOverridesSource {
  constructor(private readonly repo: DemoStateRepository) {}
  get(context?: { readonly staffId?: string }): ConfigLayer {
    const persona = personaForStaff(context?.staffId);
    return mergeConfigLayer<ConfigLayer>(persona?.config ?? {}, this.repo.get().config);
  }
}

/** "Use demo login" on the login screens: the credentials of the persona the presenter picked last. */
class DemoLoginAssist implements LoginAssistSource {
  private cache: { id: string; value: LoginAssist } | null = null;
  constructor(private readonly repo: DemoStateRepository) {}
  get(): LoginAssist {
    const persona = personaById(this.repo.get().persona);
    // Stable identity per persona, so React's external-store reads don't loop.
    if (this.cache?.id !== persona.id)
      this.cache = { id: persona.id, value: { label: 'Use demo login', who: `${persona.name} · ${persona.title}`, instituteCode: persona.instituteCode, trainerId: persona.trainerId } };
    return this.cache.value;
  }
  subscribe(listener: () => void) {
    return this.repo.subscribe(listener);
  }
}

export interface DemoAdapters {
  readonly repo: DemoStateRepository;
  readonly clock: Clock;
  readonly simulation: SimulationSource;
  readonly configOverrides: ConfigOverridesSource;
  readonly loginAssist: LoginAssistSource;
  readonly sentinel: string;
}

export function createDemoAdapters(): DemoAdapters {
  const repo = new DemoStateRepository(createDefaultStore('ksk-demo:v1'));
  return {
    repo,
    clock: new DemoClock(repo),
    simulation: new DemoSimulationSource(repo),
    configOverrides: new DemoConfigOverrides(repo),
    loginAssist: new DemoLoginAssist(repo),
    sentinel: DEMO_SENTINEL,
  };
}
