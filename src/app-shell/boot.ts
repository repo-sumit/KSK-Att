/**
 * Builds the app container in the browser. The demo layer is imported only
 * behind the NEXT_PUBLIC_DEMO_MODE constant, so production bundles contain no
 * demo code (verified by scripts/check-demo-stripped.mjs).
 */
import { createMockContainer, type AppContainer } from '@/services/container';
import { StaticSimulationSource } from '@/services/simulation';
import { createDefaultStore } from '@/lib/kv-store';
import { systemClock } from '@/lib/time';
import type { DemoAdapters } from '@/demo/adapters';

/** Opt-in (brief §56). .env.development/.env.production enable it for this demo build. */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export interface AppRuntime {
  readonly container: AppContainer;
  readonly demo: DemoAdapters | null;
}

export async function bootApp(): Promise<AppRuntime> {
  const store = createDefaultStore('ksk:v1');
  const preferencesStore = createDefaultStore('ksk-prefs');
  // Inline env comparison (not DEMO_MODE) so the bundler drops this branch when the demo is off.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const [{ createDemoAdapters }, { prepareScenario }] = await Promise.all([import('@/demo/adapters'), import('@/demo/controller')]);
    const demo = createDemoAdapters();
    const container = createMockContainer({ store, preferencesStore, clock: demo.clock, simulation: demo.simulation, configOverrides: demo.configOverrides, loginAssist: demo.loginAssist });
    // "Use demo account" prepares the picked account's story; that needs the container, built just above.
    demo.loginAssist.connect((presetId) => prepareScenario(container, demo, presetId));
    demo.repo.subscribe(() => container.bus.emit('demo'));
    container.services.sync.start();
    return { container, demo };
  }
  // Without the demo there is still no backend: mock data, but real connectivity events, the real
  // Geolocation API, the real camera and the on-device movement check. Face MATCHING stays simulated
  // and every face screen says so (docs/ARCHITECTURE.md → Face capture).
  const container = createMockContainer({ store, preferencesStore, clock: systemClock, simulation: new StaticSimulationSource(), realDevice: true });
  container.services.sync.start();
  return { container, demo: null };
}
