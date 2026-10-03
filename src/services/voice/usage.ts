/**
 * Client-side voice caps (D-089): cumulative live seconds per voice session (across reconnects),
 * daily minutes per trainer, and the idle timeout. Time is always passed in by the caller.
 */
import type { VoiceUsageRepository } from '@/repositories/interfaces';
import type { LocalDate } from '@/lib/time';

export interface VoiceLimits {
  readonly sessionMinutes: number;
  readonly idleSeconds: number;
  readonly dailyMinutes: number;
}
export type UsageStop = 'session_limit' | 'daily_limit' | 'idle';
export interface VoiceUsageDeps {
  readonly repo: VoiceUsageRepository;
  readonly staffId: string;
  readonly today: () => LocalDate;
  readonly limits: VoiceLimits;
}

const WRITE_EVERY_SECONDS = 15;

export class VoiceUsage {
  private sessionSeconds = 0;
  /** Seconds used on `date` by earlier sessions (the repository total minus what this instance wrote on that date). */
  private usedBefore = 0;
  /** Seconds this instance has written to the repository for `date`. Starts again when the date changes. */
  private written = 0;
  /** `sessionSeconds` when `date` began for this instance: seconds before it belong to an earlier day. */
  private dayBase = 0;
  /** Counted but not yet written, by the IST date they belong to (a session can run across midnight). */
  private unwritten = new Map<LocalDate, number>();
  private retryNextTick = false;
  private lastActivityMs: number | null = null;
  private date: LocalDate | null = null;
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly deps: VoiceUsageDeps) {}

  async canStart(): Promise<{ ok: true; dailySecondsLeft: number } | { ok: false; reason: 'daily_limit' }> {
    const date = this.deps.today();
    this.rollTo(date);
    await this.writes;
    // This instance's own writes are already in the repository total; subtract them so a reconnect never double-counts.
    this.usedBefore = (await this.deps.repo.get(this.deps.staffId, date)) - this.written;
    const left = this.dailyCapSeconds - this.usedBefore - this.todaySeconds;
    if (left <= 0) return { ok: false, reason: 'daily_limit' };
    return { ok: true, dailySecondsLeft: left };
  }

  tick(nowMs: number): UsageStop | null {
    this.lastActivityMs ??= nowMs;
    this.rollTo(this.deps.today());
    this.sessionSeconds += 1;
    this.addUnwritten(this.date as LocalDate, 1);
    if (this.unwrittenTotal >= WRITE_EVERY_SECONDS || this.retryNextTick) this.persist();
    if (this.sessionSeconds >= this.sessionCapSeconds) return 'session_limit';
    if (this.usedBefore + this.todaySeconds >= this.dailyCapSeconds) return 'daily_limit';
    if (nowMs - this.lastActivityMs >= this.deps.limits.idleSeconds * 1000) return 'idle';
    return null;
  }

  activity(nowMs: number): void {
    this.lastActivityMs = nowMs;
  }

  async flush(): Promise<void> {
    this.persist();
    await this.writes;
  }

  get sessionSecondsLeft(): number {
    return Math.max(0, this.sessionCapSeconds - this.sessionSeconds);
  }

  /** Before whichever cap comes first: this session's or today's (today's as of the last canStart). */
  get secondsLeft(): number {
    return Math.max(0, Math.min(this.sessionCapSeconds - this.sessionSeconds, this.dailyCapSeconds - this.usedBefore - this.todaySeconds));
  }

  private get sessionCapSeconds(): number {
    return this.deps.limits.sessionMinutes * 60;
  }

  private get dailyCapSeconds(): number {
    return this.deps.limits.dailyMinutes * 60;
  }

  /** Seconds of this session that fall on the current date. */
  private get todaySeconds(): number {
    return this.sessionSeconds - this.dayBase;
  }

  private get unwrittenTotal(): number {
    let total = 0;
    for (const seconds of this.unwritten.values()) total += seconds;
    return total;
  }

  private addUnwritten(date: LocalDate, seconds: number): void {
    this.unwritten.set(date, (this.unwritten.get(date) ?? 0) + seconds);
  }

  /**
   * The IST date changed (a session across midnight): the seconds counted so far stay with the old date, and
   * the counters for the new day start again, so the rest of the session counts toward the new day's cap.
   */
  private rollTo(date: LocalDate): void {
    if (this.date === date) return;
    if (this.date !== null) {
      this.persist(); // the old day's seconds go to the old day
      this.written = 0;
      this.usedBefore = 0; // the new day's earlier use is read by the next canStart
      this.dayBase = this.sessionSeconds;
    }
    this.date = date;
  }

  /**
   * Writes are serialised. Each date's seconds are taken out before the write starts (the value is fixed
   * before the await). A failed write puts its seconds back and `retryNextTick` makes the next tick write
   * again (and so on, once a tick, until the repository takes them); `flush` retries them too. The failure
   * itself is not reported: VoiceUsage has no log or error path, and the retry is what keeps the count.
   */
  private persist(): void {
    this.retryNextTick = false;
    for (const [date, seconds] of [...this.unwritten]) {
      this.unwritten.delete(date);
      if (seconds <= 0) continue;
      this.writes = this.writes.then(() =>
        this.deps.repo.add(this.deps.staffId, date, seconds).then(
          () => {
            if (date === this.date) this.written += seconds;
          },
          () => {
            this.addUnwritten(date, seconds);
            this.retryNextTick = true;
          },
        ),
      );
    }
  }
}
