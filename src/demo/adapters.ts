/**
 * DEMO ONLY — the single entry point the app imports (behind
 * NEXT_PUBLIC_DEMO_MODE). Turns DemoState into the interfaces the core already
 * accepts: a Clock, a SimulationSource and a ConfigOverridesSource.
 */
import type { ConfigLayer } from '@/config/types';
import type { ConfigOverridesSource } from '@/services/configuration';
import type { SimulationSource, SimulationState } from '@/services/simulation';
import { createDefaultStore } from '@/lib/kv-store';
import { instantAt, toLocalDate, type Clock } from '@/lib/time';
import { DemoStateRepository } from './store';
import { personaForStaff } from './personas';
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

export interface DemoAdapters {
  readonly repo: DemoStateRepository;
  readonly clock: Clock;
  readonly simulation: SimulationSource;
  readonly configOverrides: ConfigOverridesSource;
  readonly sentinel: string;
}

export function createDemoAdapters(): DemoAdapters {
  const repo = new DemoStateRepository(createDefaultStore('ksk-demo:v1'));
  return {
    repo,
    clock: new DemoClock(repo),
    simulation: new DemoSimulationSource(repo),
    configOverrides: new DemoConfigOverrides(repo),
    sentinel: DEMO_SENTINEL,
  };
}
