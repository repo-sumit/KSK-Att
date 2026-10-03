/**
 * MarkingDraftService (D-084): one live draft per session key, shared by the tap roster, the review
 * screen and the voice executor. It holds the marks, who made each trainer mark (tap or voice, when,
 * what was heard), the presets nobody calls (OJT, carried leave), a revision number and change events.
 * Every change is written to the device draft at once, so a reload or a new session context never
 * loses a valid mark. OJT stays locked here, for taps and voice alike (PRD §9.6).
 */
import type { AppConfiguration } from '@/config/types';
import type { AttendanceDraft, SessionKey } from '@/domain/attendance';
import type { Student, StudentId } from '@/domain/entities';
import { marksEqual, type Mark } from '@/domain/status';
import { safeText, type MarkSource, type MarkVia } from '@/domain/voice/types';
import type { AttendanceRepository } from '@/repositories/interfaces';
import type { RosterData } from './attendance';
import type { SessionContext } from './context';

export interface DraftSnapshot {
  readonly key: SessionKey;
  /** Roll order. */
  readonly students: readonly Student[];
  readonly marks: Readonly<Record<StudentId, Mark>>;
  readonly sources: Readonly<Record<StudentId, MarkSource>>;
  /** OJT, and carried leave nobody has touched yet: never called in a roll call. */
  readonly presets: ReadonlySet<StudentId>;
  readonly revision: number;
  readonly locked: boolean;
}

export type DraftChangeKind = 'opened' | 'mark' | 'bulk' | 'submitted' | 'closed';

export interface DraftChange {
  readonly kind: DraftChangeKind;
  readonly key: SessionKey;
  /** The students whose mark changed (empty for opened, submitted and closed). */
  readonly studentIds: readonly StudentId[];
  readonly via: MarkVia | 'system';
  readonly before: DraftSnapshot | undefined;
  readonly after: DraftSnapshot | undefined;
}

export interface MarkingDraftDeps {
  readonly attendance: AttendanceRepository;
  readonly now: () => Date;
}

export interface MarkInput {
  readonly via: MarkVia;
  readonly heard?: string;
}

/** What was heard is kept short and inert (spec D-084: at most 160 characters). */
const HEARD_MAX = 160;

interface Entry {
  snapshot: DraftSnapshot;
  /** The configuration object the draft was last opened with (the same object skips the fingerprint). */
  config: AppConfiguration;
  /** The fingerprint of that configuration: only a structurally different one rebuilds the draft. */
  readonly fingerprint: string;
  readonly ids: ReadonlySet<StudentId>;
  readonly ojt: ReadonlySet<StudentId>;
}

type Listener = (change: DraftChange) => void;

/** Drops keys whose value is undefined, so a cleared detail really disappears. */
function clean(mark: Mark): Mark {
  return Object.fromEntries(Object.entries(mark).filter(([, v]) => v !== undefined)) as unknown as Mark;
}

/** A detail for the same status is merged into the current mark; a new status replaces it. */
function nextMark(current: Mark | undefined, mark: Mark): Mark {
  return clean(current && current.status === mark.status ? { ...current, ...mark } : mark);
}

const isCarriedLeave = (mark: Mark | undefined, source: MarkSource | undefined) => !source && mark?.status === 'leave' && Boolean(mark.leaveUntil);

/** Plain data as text with its object keys sorted, so two equal configurations give the same text whatever built them. */
function fingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v,
  );
}

export class MarkingDraftService {
  private readonly entries = new Map<SessionKey, Entry>();
  /** The highest revision each key reached: revisions only grow, also across close() and a re-open (D-082 binds them). */
  private readonly revisions = new Map<SessionKey, number>();
  private readonly listeners = new Map<SessionKey | '*', Set<{ readonly fn: Listener }>>();
  /** Submits being saved per key (the screen's and voice's can overlap): while any runs, the draft takes no change. */
  private readonly holds = new Map<SessionKey, number>();

  constructor(private readonly deps: MarkingDraftDeps) {}

  /**
   * Seeds the live draft from an opened roster. An equal configuration keeps the live draft (idempotent):
   * the session reloads build a new but equal configuration object, and a rebuild would bump the revision
   * and void an open confirmation (D-082). A configuration that really differs rebuilds it from the roster,
   * which `openRoster` already merged with the saved draft and filtered for validity, keeping a source only
   * where that student's mark survived.
   */
  open(ctx: SessionContext, roster: RosterData, persisted?: AttendanceDraft): DraftSnapshot {
    const key = roster.card.key;
    const live = this.entries.get(key);
    if (live && live.config === ctx.config) return live.snapshot;
    const print = fingerprint(ctx.config);
    if (live && live.fingerprint === print) {
      live.config = ctx.config;
      return live.snapshot;
    }

    const marks: Record<StudentId, Mark> = { ...roster.marks };
    const ojt = new Set(roster.students.filter((s) => marks[s.id]?.status === 'ojt').map((s) => s.id));
    const sources: Record<StudentId, MarkSource> = {};
    for (const { id } of roster.students) {
      if (ojt.has(id) || !marks[id]) continue;
      const survived = (mark: Mark | undefined) => mark !== undefined && marksEqual(mark, marks[id]);
      const source =
        (survived(live?.snapshot.marks[id]) ? live?.snapshot.sources[id] : undefined) ??
        (survived(persisted?.marks[id]) ? persisted?.sources?.[id] : undefined) ??
        roster.sources?.[id];
      if (source) sources[id] = source;
    }
    const presets = new Set([...ojt, ...roster.students.filter((s) => isCarriedLeave(marks[s.id], sources[s.id])).map((s) => s.id)]);
    const reached = this.revisions.get(key);
    const snapshot: DraftSnapshot = { key, students: roster.students, marks, sources, presets, revision: reached === undefined ? 0 : reached + 1, locked: false };
    this.revisions.set(key, snapshot.revision);
    this.entries.set(key, { snapshot, config: ctx.config, fingerprint: print, ids: new Set(roster.students.map((s) => s.id)), ojt });
    this.emit({ kind: 'opened', key, studentIds: [], via: 'system', before: live?.snapshot, after: snapshot });
    return snapshot;
  }

  get(key: SessionKey): DraftSnapshot | undefined {
    return this.entries.get(key)?.snapshot;
  }

  /** For useSyncExternalStore: the listener runs on any change to `key` ('*' = all keys). */
  subscribe(key: SessionKey | '*', listener: Listener): () => void {
    const entry = { fn: listener };
    const set = this.listeners.get(key) ?? new Set();
    set.add(entry);
    this.listeners.set(key, set);
    return () => {
      set.delete(entry);
      if (set.size === 0 && this.listeners.get(key) === set) this.listeners.delete(key);
    };
  }

  /**
   * No-op (same snapshot) for OJT, unknown students, a locked draft, a draft a submit is saving, or an equal mark with no new detail.
   * One exception: a voice mark on a student with no trainer source records it even when the mark equals
   * the default ("present" in a roll call over default present), because the spoken answer is the trainer's.
   */
  setMark(key: SessionKey, studentId: StudentId, mark: Mark, source: MarkInput): DraftSnapshot | undefined {
    return this.apply(key, [studentId], mark, source, 'mark');
  }

  /** mark_remaining: one revision for every id that changes. */
  setMany(key: SessionKey, studentIds: readonly StudentId[], mark: Mark, source: MarkInput): DraftSnapshot | undefined {
    return this.apply(key, studentIds, mark, source, 'bulk');
  }

  /** Writes the draft now (review and submit read the saved record through openRoster). */
  async flush(key: SessionKey): Promise<void> {
    const entry = this.entries.get(key);
    if (entry) await this.deps.attendance.saveDraft(this.record(entry.snapshot, entry.config));
  }

  /**
   * A submit starts saving the draft: until endSubmit (or close), every mark is refused (no change, no event), so
   * what was sent is exactly what is stored, whoever submits (the screen or voice). Returns the snapshot to send.
   */
  beginSubmit(key: SessionKey): DraftSnapshot | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.holds.set(key, (this.holds.get(key) ?? 0) + 1);
    return entry.snapshot;
  }

  /** The submit that beginSubmit started has finished (whatever its result): the draft takes changes again once no other submit runs. */
  endSubmit(key: SessionKey): void {
    const n = (this.holds.get(key) ?? 0) - 1;
    if (n > 0) this.holds.set(key, n);
    else this.holds.delete(key);
  }

  /**
   * Runs `save` with the draft held (beginSubmit, then endSubmit) and passes it the snapshot to send. With no live
   * draft no hold is taken, `save` gets undefined, and nothing is released afterwards: an endSubmit without its own
   * hold would end another submit's hold early (voice's, taken on the same key meanwhile).
   */
  async whileSubmitting<T>(key: SessionKey, save: (sent: DraftSnapshot | undefined) => Promise<T>): Promise<T> {
    const sent = this.beginSubmit(key);
    try {
      return await save(sent);
    } finally {
      if (sent) this.endSubmit(key);
    }
  }

  /** A submit is saving this draft now: a mark would not be part of it, so none is taken. */
  isSubmitting(key: SessionKey): boolean {
    return this.holds.has(key);
  }

  /**
   * After a successful submit (kind 'submitted', via who submitted, with the snapshot that was `sent`) or when
   * discarded. The submitted change carries what was sent, so it always equals the stored record. The saved draft
   * is left to the submit.
   */
  close(key: SessionKey, how: { readonly kind: 'submitted' | 'closed'; readonly via: MarkVia | 'system'; readonly sent?: DraftSnapshot }): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    const after = how.kind === 'submitted' ? { ...(how.sent ?? entry.snapshot), locked: true } : undefined;
    this.emit({ kind: how.kind, key, studentIds: [], via: how.via, before: entry.snapshot, after });
  }

  private apply(key: SessionKey, studentIds: readonly StudentId[], mark: Mark, input: MarkInput, kind: 'mark' | 'bulk'): DraftSnapshot | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    const before = entry.snapshot;
    // OJT is declared in the ERP, never chosen (PRD §9.6): nobody can set it, or change it.
    // While a submit saves the draft, a change would not be in the record: refused, as on a locked draft.
    if (before.locked || this.holds.has(key) || mark.status === 'ojt') return before;
    const differs = (id: StudentId) => {
      const current = before.marks[id];
      return current === undefined || !marksEqual(current, nextMark(current, mark));
    };
    // A spoken answer is the trainer's even when it equals the default: it records the source the roll call counts.
    const unsourced = (id: StudentId) => input.via === 'voice' && !Object.prototype.hasOwnProperty.call(before.sources, id);
    const changed = [...new Set(studentIds)].filter((id) => entry.ids.has(id) && !entry.ojt.has(id) && (differs(id) || unsourced(id)));
    if (changed.length === 0) return before;

    const heard = input.heard === undefined ? '' : safeText(input.heard, HEARD_MAX);
    const source: MarkSource = { via: input.via, at: this.deps.now().toISOString(), ...(heard ? { heard } : {}) };
    // Only the changed rows get new objects, so every other row keeps its reference (memoised rows skip re-render).
    const marks = { ...before.marks };
    const sources = { ...before.sources };
    for (const id of changed) {
      marks[id] = nextMark(before.marks[id], mark);
      sources[id] = source;
    }
    // A trainer mark on carried leave makes it the trainer's own: it is no longer a preset.
    const presets = changed.some((id) => before.presets.has(id)) ? new Set([...before.presets].filter((id) => !changed.includes(id))) : before.presets;
    const after: DraftSnapshot = { ...before, marks, sources, presets, revision: before.revision + 1 };
    entry.snapshot = after;
    this.revisions.set(key, after.revision);
    void this.deps.attendance.saveDraft(this.record(after, entry.config)).catch(() => undefined);
    this.emit({ kind, key, studentIds: changed, via: input.via, before, after });
    return after;
  }

  /**
   * The device draft. What was heard stays in the live snapshot only while transcriptRetentionDays is 0 (the dock
   * promises "Nothing is recorded"): a saved source is `{ via, at }`.
   */
  private record(snapshot: DraftSnapshot, config: AppConfiguration): AttendanceDraft {
    // Fails closed: a configuration without a voice block (a test double) keeps nothing.
    const keepHeard = (config.voice?.transcriptRetentionDays ?? 0) > 0;
    const sources = keepHeard
      ? snapshot.sources
      : Object.fromEntries(Object.entries(snapshot.sources).map(([id, { via, at }]) => [id, { via, at }]));
    return { sessionKey: snapshot.key, marks: snapshot.marks, sources, updatedAt: this.deps.now().toISOString() };
  }

  private emit(change: DraftChange): void {
    for (const key of [change.key, '*'] as const) {
      for (const { fn } of [...(this.listeners.get(key) ?? [])]) {
        try {
          fn(change);
        } catch {
          // Listeners only observe (screens, voice): a failing one must never break marking.
        }
      }
    }
  }
}
