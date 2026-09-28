/**
 * DEMO ONLY. The presenter's state: configuration overrides, simulated
 * outcomes and the demo clock. Removable with the rest of src/demo.
 */
import type { ConfigLayer } from '@/config/types';
import { DEFAULT_SIMULATION, type SimulationState } from '@/services/simulation';
import type { LocalTime } from '@/lib/time';
import type { PersonaId } from './personas';

export type DemoClockSetting = { readonly mode: 'fixed'; readonly time: LocalTime } | { readonly mode: 'real' };

export interface DemoState {
  readonly version: 1;
  readonly presetId: string | null;
  /** The persona the presenter picked last (preset, quick login, skip login, demo account): highlighted under "Use demo account". */
  readonly persona: PersonaId;
  /** Advanced: quick login signs straight in instead of opening the login screens. */
  readonly skipLogin: boolean;
  readonly config: ConfigLayer;
  readonly simulation: SimulationState;
  readonly clock: DemoClockSetting;
}

/** 10:15 AM: Shift 1 open, Shift 2 opens at 2 PM, timetable Period 3 is "Now". */
export const DEFAULT_DEMO_TIME: LocalTime = '10:15';

export const DEFAULT_DEMO_STATE: DemoState = {
  version: 1,
  presetId: 'open',
  persona: 'open',
  skipLogin: false,
  config: {},
  simulation: DEFAULT_SIMULATION,
  clock: { mode: 'fixed', time: DEFAULT_DEMO_TIME },
};

export function decodeDemoState(raw: unknown): DemoState {
  if (!raw || typeof raw !== 'object' || (raw as { version?: unknown }).version !== 1) return DEFAULT_DEMO_STATE;
  const s = raw as Partial<DemoState>;
  return {
    ...DEFAULT_DEMO_STATE,
    ...s,
    simulation: { ...DEFAULT_SIMULATION, ...s.simulation, permissions: { ...DEFAULT_SIMULATION.permissions, ...s.simulation?.permissions } },
  };
}
