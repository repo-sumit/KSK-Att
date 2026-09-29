/**
 * DEMO ONLY. Quick presets from the brief (§9): each sets a persona, the
 * configuration story it demonstrates, simulated outcomes, and where to start.
 * Each `line` fits two lines of a 360px panel tile (never clamped): the geo-fence,
 * face and Present-default settings shared by every preset are left out. "geo‑fence"
 * uses a non-breaking hyphen (U+2011) so a 320px tile never splits it.
 */
import type { ConfigLayer } from '@/config/types';
import type { SimulationState } from '@/services/simulation';
import type { PersonaId } from './personas';

export interface DemoPreset {
  readonly id: string;
  readonly title: string;
  readonly line: string;
  readonly persona: PersonaId;
  readonly config: ConfigLayer;
  readonly simulation?: Partial<SimulationState>;
  /** First-time user: face not enrolled, permissions not yet asked, starts at login. */
  readonly firstTime?: boolean;
  readonly start: 'home' | 'login';
}

const STRICT: ConfigLayer = { verification: { geoMode: 'fencing', face: true }, marking: { defaultStatus: 'present' } };

export const PRESETS: readonly DemoPreset[] = [
  { id: 'open', title: 'Open instructor', line: 'Any trade · geo\u2011fence · face', persona: 'open', config: STRICT, start: 'home' },
  { id: 'batch', title: 'Batch mapped', line: 'Only assigned batches', persona: 'batch', config: STRICT, start: 'home' },
  { id: 'timetable', title: 'Timetable', line: 'Periods · time fenced', persona: 'timetable', config: STRICT, start: 'home' },
  { id: 'es', title: 'Employability Skills', line: 'Batches across trades', persona: 'es', config: STRICT, start: 'home' },
  { id: 'principal', title: 'Principal', line: 'Institute · corrections · staff', persona: 'principal', config: STRICT, start: 'home' },
  {
    id: 'first_time',
    title: 'First-time user',
    line: 'Face not set up · asks permissions',
    persona: 'open',
    config: STRICT,
    simulation: { permissions: { location: 'prompt', camera: 'prompt' } },
    firstTime: true,
    start: 'login',
  },
  { id: 'offline', title: 'Offline', line: 'No network · sync pending', persona: 'open', config: STRICT, simulation: { online: false }, start: 'home' },
];
