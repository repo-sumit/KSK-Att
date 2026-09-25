/**
 * DEMO ONLY. Quick presets from the brief (§9): each sets a persona, the
 * configuration story it demonstrates, simulated outcomes, and where to start.
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
  readonly start: 'home' | 'login' | 'attendance';
}

const STRICT: ConfigLayer = { verification: { geoMode: 'fencing', face: true }, marking: { defaultStatus: 'present' } };

export const PRESETS: readonly DemoPreset[] = [
  { id: 'open', title: 'Open instructor', line: 'Any trade · geo-fence · face · Present default', persona: 'open', config: STRICT, start: 'home' },
  { id: 'batch', title: 'Batch mapped', line: 'Only assigned classes', persona: 'batch', config: STRICT, start: 'home' },
  { id: 'timetable', title: 'Timetable', line: 'Hard timetable · periods · time fenced', persona: 'timetable', config: STRICT, start: 'home' },
  { id: 'es', title: 'Employability Skills', line: 'Several trades, selected batches', persona: 'es', config: STRICT, start: 'home' },
  { id: 'principal', title: 'Principal', line: 'Institute view · corrections · staff · reports', persona: 'principal', config: STRICT, start: 'home' },
  {
    id: 'first_time',
    title: 'First-time user',
    line: 'Login · face not registered · permissions asked',
    persona: 'open',
    config: STRICT,
    simulation: { permissions: { location: 'prompt', camera: 'prompt' } },
    firstTime: true,
    start: 'login',
  },
  { id: 'offline', title: 'Offline', line: 'Downloaded roster · no network · pending sync', persona: 'open', config: STRICT, simulation: { online: false }, start: 'home' },
];
