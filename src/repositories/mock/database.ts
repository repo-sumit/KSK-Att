/**
 * The mock "database": typed collections over a KeyValueStore, seeded from
 * data/mock relative to today. Every mock repository reads and writes through
 * this. Reset Demo = `reset()`; a new calendar day reseeds automatically so
 * "today" in the demo always means today.
 */
import type { AttendanceDraft, AttendanceSubmission, Correction, OfflineQueueItem, StaffAttendanceRecord } from '@/domain/attendance';
import type { BatchPack, FaceEnrolment } from '@/domain/device';
import type { EventBus, DataTopic } from '@/lib/events';
import type { KeyValueStore } from '@/lib/kv-store';
import { toLocalDate, type Clock, type LocalDate } from '@/lib/time';
import { buildSeed } from '@/data/mock/seeds';
import type { StoredSession, VerificationPass } from '../interfaces';

/** Bump when the stored shape changes, so old demo state is discarded instead of misread. */
const SCHEMA_VERSION = 1;

export interface Collections {
  submissions: Record<string, AttendanceSubmission>;
  drafts: Record<string, AttendanceDraft>;
  corrections: Correction[];
  staff: Record<string, StaffAttendanceRecord>;
  face: Record<string, FaceEnrolment>;
  passes: Record<string, VerificationPass>;
  queue: OfflineQueueItem[];
  packs: Record<string, BatchPack>;
  session: StoredSession | null;
}

type Key = keyof Collections;

interface SeedMarker {
  readonly version: number;
  readonly date: LocalDate;
}

export const staffKey = (staffId: string, date: LocalDate) => `${staffId}@${date}`;

export class MockDatabase {
  constructor(
    private readonly store: KeyValueStore,
    private readonly clock: Clock,
    private readonly bus: EventBus,
  ) {}

  today(): LocalDate {
    return toLocalDate(this.clock.now());
  }

  /** Seeds on first use, on schema change, and when the calendar day changes. */
  ensureSeeded(): void {
    const marker = this.store.get<SeedMarker>('seed');
    if (marker && marker.version === SCHEMA_VERSION && marker.date === this.today()) return;
    this.seed();
  }

  /** Restores the complete demo story (Reset Demo). */
  reset(): void {
    this.store.clear();
    this.seed();
    this.bus.emit('session', 'attendance', 'corrections', 'staff', 'face', 'verification', 'offline', 'packs', 'preferences', 'demo');
  }

  private seed(): void {
    const today = this.today();
    const seed = buildSeed(today);
    this.store.clear();
    this.store.set<Collections['submissions']>('submissions', Object.fromEntries(seed.submissions.map((s) => [s.sessionKey, s])));
    this.store.set<Collections['drafts']>('drafts', {});
    this.store.set<Collections['corrections']>('corrections', [...seed.corrections]);
    this.store.set<Collections['staff']>('staff', Object.fromEntries(seed.staffRecords.map((r) => [staffKey(r.staffId, r.date), r])));
    this.store.set<Collections['face']>('face', Object.fromEntries(seed.faceEnrolments.map((f) => [f.staffId, f])));
    this.store.set<Collections['passes']>('passes', {});
    this.store.set<Collections['queue']>('queue', []);
    this.store.set<Collections['packs']>('packs', Object.fromEntries(seed.packs.map((p) => [p.batchId, p])));
    this.store.set<Collections['session']>('session', null);
    this.store.set<SeedMarker>('seed', { version: SCHEMA_VERSION, date: today });
  }

  /** Demo: a configuration or persona change is a new session — earlier verification passes no longer apply. */
  clearPasses(): void {
    this.write('passes', {}, 'verification');
  }

  /** Demo: toggle "Face registered" for a user. */
  setFaceEnrolled(staffId: string, enrolled: boolean, at: string): void {
    this.update(
      'face',
      (all) => {
        const next = { ...all };
        if (enrolled) next[staffId] = { staffId, enrolledAt: at, sampleCount: 3, simulated: true };
        else delete next[staffId];
        return next;
      },
      'face',
    );
  }

  read<K extends Key>(key: K): Collections[K] {
    this.ensureSeeded();
    const value = this.store.get<Collections[K]>(key);
    if (value === undefined) throw new Error(`Mock collection "${key}" missing after seeding`);
    return value;
  }

  write<K extends Key>(key: K, value: Collections[K], ...topics: DataTopic[]): void {
    this.store.set(key, value);
    if (topics.length) this.bus.emit(...topics);
  }

  update<K extends Key>(key: K, fn: (current: Collections[K]) => Collections[K], ...topics: DataTopic[]): void {
    this.write(key, fn(this.read(key)), ...topics);
  }
}
