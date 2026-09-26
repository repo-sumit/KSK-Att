/**
 * DEMO ONLY. Everything the presenter can do, expressed through the same
 * interfaces the app already uses (auth, config overrides, simulation, clock).
 */
import { mergeConfigLayer } from '@/config/resolve';
import type { ConfigLayer, Language } from '@/config/types';
import { toSessionKey } from '@/domain/attendance';
import { initialMarks } from '@/domain/marking';
import { createId } from '@/lib/ids';
import { toLocalDate, type LocalTime } from '@/lib/time';
import type { AppContainer } from '@/services/container';
import { DEFAULT_SIMULATION, type SimulationState } from '@/services/simulation';
import type { DemoAdapters } from './adapters';
import { personaById, type PersonaId } from './personas';
import { PRESETS } from './presets';
import { DEFAULT_DEMO_TIME } from './state';

export type NetworkMode = 'online' | 'offline' | 'pending';
const INSTITUTE_ID = 'inst-27410';

export class DemoController {
  constructor(
    private readonly app: AppContainer,
    private readonly demo: DemoAdapters,
    private readonly navigate: (href: string) => void,
  ) {}

  private now() {
    return this.app.clock.now();
  }

  /** Live configuration change = a new session start (PRD §5.2): passes are revoked, the session re-resolves. */
  setConfig(patch: ConfigLayer): void {
    this.demo.repo.update((s) => ({ ...s, presetId: null, config: mergeConfigLayer<ConfigLayer>(s.config, patch) }));
    this.app.mockDatabase.clearPasses();
  }

  setSimulation(patch: Partial<SimulationState>): void {
    this.demo.repo.update((s) => ({ ...s, simulation: { ...s.simulation, ...patch } }));
  }

  setClock(time: LocalTime | 'real'): void {
    this.demo.repo.update((s) => ({ ...s, clock: time === 'real' ? { mode: 'real' } : { mode: 'fixed', time } }));
  }

  async setLanguage(language: Language): Promise<void> {
    await this.app.repositories.preferences.setLanguage(language);
  }

  async setFaceEnrolled(enrolled: boolean): Promise<void> {
    const session = await this.app.repositories.session.get();
    if (session) this.app.mockDatabase.setFaceEnrolled(session.staffId, enrolled, this.now().toISOString());
  }

  /** Skip login (Advanced): straight into the persona's session. */
  async signInAs(personaId: PersonaId, go = true): Promise<void> {
    const persona = personaById(personaId);
    // The persona brings its own mapping; drop any explicit mapping override from the panel.
    this.demo.repo.update((s) => ({ ...s, persona: persona.id, config: { ...s.config, mapping: undefined } }));
    this.app.mockDatabase.clearPasses();
    await this.app.services.auth.startSession(INSTITUTE_ID, persona.staffId);
    if (go) this.navigate('/home');
  }

  /**
   * Quick login: pick who to demonstrate, then show the real login steps with that
   * persona's credentials one tap away ("Use demo login"). Nothing is typed or
   * submitted for the presenter. With "Skip login" on, signs straight in instead.
   */
  async quickLogin(personaId: PersonaId): Promise<void> {
    if (this.demo.repo.get().skipLogin) return this.signInAs(personaId);
    const persona = personaById(personaId);
    this.demo.repo.update((s) => ({ ...s, persona: persona.id, config: { ...s.config, mapping: undefined } }));
    this.app.mockDatabase.clearPasses();
    await this.app.services.auth.signOut();
    this.navigate('/login');
  }

  setSkipLogin(skip: boolean): void {
    this.demo.repo.update((s) => ({ ...s, skipLogin: skip }));
  }

  async setNetwork(mode: NetworkMode): Promise<void> {
    if (mode === 'pending') {
      this.setConfig({ offline: { autoSync: false } });
      this.setSimulation({ online: true });
      if ((await this.app.repositories.offlineQueue.list()).length === 0) await this.seedPendingRecord();
      return;
    }
    this.setConfig({ offline: { autoSync: true } });
    this.setSimulation({ online: mode === 'online' });
    if (mode === 'online') void this.app.services.sync.syncNow();
  }

  /** Puts one locally locked, unsynced submission on the phone (for "Pending sync"). */
  private async seedPendingRecord(): Promise<void> {
    const ctx = await this.app.services.session.load();
    if (!ctx) return;
    const cards = (await Promise.all([...ctx.access.batchIds].map((id) => this.app.services.attendance.cardsForBatch(ctx, id)))).flat();
    const card = cards.find((c) => c.status === 'open') ?? cards.find((c) => c.status !== 'submitted');
    if (!card) return;
    const students = ctx.data.students.filter((s) => s.batchId === card.batch.id);
    const marks = initialMarks(students, { marking: ctx.config.marking, date: toLocalDate(this.now()), ojt: ctx.data.ojt, carriedLeave: {} });
    const at = this.now().toISOString();
    const submission = { id: createId('att'), sessionKey: toSessionKey(card.address), address: card.address, marks, markedBy: ctx.user.id, deviceTimestamp: at, syncState: 'pending' as const };
    await this.app.repositories.attendance.createSubmission(submission);
    await this.app.repositories.offlineQueue.enqueue({ id: createId('q'), kind: 'attendance_submission', recordId: submission.id, label: submission.sessionKey, enqueuedAt: at, attempts: 0 });
    this.app.services.sync.request();
  }

  async applyPreset(id: string): Promise<void> {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const persona = personaById(preset.persona);
    this.demo.repo.update((s) => ({
      ...s,
      presetId: preset.id,
      persona: preset.persona,
      config: preset.config,
      // Speed and the camera choice belong to the presenting machine (e.g. a laptop without a camera), not to the story.
      simulation: { ...DEFAULT_SIMULATION, speed: s.simulation.speed, camera: s.simulation.camera, liveness: s.simulation.liveness, ...preset.simulation },
      clock: { mode: 'fixed', time: DEFAULT_DEMO_TIME },
    }));
    this.app.mockDatabase.clearPasses();
    this.app.mockDatabase.setFaceEnrolled(persona.staffId, !preset.firstTime, this.now().toISOString());
    if (preset.start === 'login') {
      await this.app.services.auth.signOut();
      this.navigate('/login');
      return;
    }
    await this.app.services.auth.startSession(INSTITUTE_ID, persona.staffId);
    this.navigate(preset.start === 'attendance' ? '/attendance' : '/home');
  }

  /** Complete by construction: wipe every namespace and reload from scratch. */
  reset(): void {
    for (const ns of ['ksk:v1:', 'ksk-demo:v1:', 'ksk-prefs:']) {
      for (const key of Object.keys(window.localStorage)) if (key.startsWith(ns)) window.localStorage.removeItem(key);
    }
    window.location.replace('/');
  }
}
