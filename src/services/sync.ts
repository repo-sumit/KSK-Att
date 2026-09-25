/**
 * SyncService — pushes locally locked records to the server (PRD §20.5).
 * States: idle (nothing pending) · pending · syncing · synced · failed, plus
 * online/offline from connectivity. Triggers: automatic on reconnect and on
 * app start when online, manual "Sync now", and before opening another batch.
 * A record stays locked on the
 * device whether or not it has synced (INV-03).
 */
import type { OfflineQueueItem } from '@/domain/attendance';
import type { EventBus } from '@/lib/events';
import type { AttendanceRepository, OfflineQueueRepository, StaffAttendanceRepository, SyncGateway } from '@/repositories/interfaces';
import type { ConnectivityService } from './connectivity';

export type SyncPhase = 'idle' | 'pending' | 'syncing' | 'synced' | 'failed';

export interface SyncStatus {
  readonly phase: SyncPhase;
  readonly online: boolean;
  readonly pending: number;
}

export interface SyncDeps {
  readonly queue: OfflineQueueRepository;
  readonly attendance: AttendanceRepository;
  readonly staff: StaffAttendanceRepository;
  readonly gateway: SyncGateway;
  readonly connectivity: ConnectivityService;
  readonly bus: EventBus;
  readonly autoSync: () => boolean;
  /** How long the "All attendance synced" confirmation stays before returning to idle. */
  readonly confirmationMs: () => number;
}

export class SyncService {
  private phase: SyncPhase = 'idle';
  private pendingCount = 0;
  private running: Promise<SyncStatus> | null = null;
  private confirmTimer: ReturnType<typeof setTimeout> | undefined;
  private unsubscribe: (() => void) | undefined;

  constructor(private readonly deps: SyncDeps) {}

  /** Starts listening for connectivity changes (auto-sync trigger). */
  start(): void {
    this.unsubscribe?.();
    this.unsubscribe = this.deps.connectivity.subscribe((online) => {
      this.emit();
      if (online && this.deps.autoSync()) void this.syncNow();
    });
    // Records left in the queue by an earlier visit go out as soon as the app opens online.
    void this.refreshCount().then(() => {
      if (this.pendingCount > 0 && this.deps.connectivity.isOnline() && this.deps.autoSync()) void this.syncNow();
    });
  }

  stop(): void {
    this.unsubscribe?.();
    clearTimeout(this.confirmTimer);
  }

  status(): SyncStatus {
    return { phase: this.phase, online: this.deps.connectivity.isOnline(), pending: this.pendingCount };
  }

  async pendingItems(): Promise<OfflineQueueItem[]> {
    return this.deps.queue.list();
  }

  /** Called after a record is locked locally. */
  request(): void {
    void this.refreshCount().then(() => {
      if (this.deps.connectivity.isOnline() && this.deps.autoSync()) void this.syncNow();
    });
  }

  /** Clears transient state after Reset Demo. */
  async reset(): Promise<void> {
    clearTimeout(this.confirmTimer);
    this.phase = 'idle';
    await this.refreshCount();
  }

  private emit() {
    this.deps.bus.emit('offline');
  }

  private async refreshCount() {
    this.pendingCount = (await this.deps.queue.list()).length;
    if (this.phase === 'idle' && this.pendingCount > 0) this.phase = 'pending';
    if (this.phase === 'pending' && this.pendingCount === 0) this.phase = 'idle';
    this.emit();
  }

  syncNow(): Promise<SyncStatus> {
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(): Promise<SyncStatus> {
    const items = await this.deps.queue.list();
    this.pendingCount = items.length;
    if (!items.length) {
      this.phase = 'idle';
      this.emit();
      return this.status();
    }
    if (!this.deps.connectivity.isOnline()) {
      this.phase = 'pending';
      this.emit();
      return this.status();
    }
    clearTimeout(this.confirmTimer);
    this.phase = 'syncing';
    this.emit();
    let failed = false;
    for (const item of items) {
      const ok = await this.pushOne(item);
      if (!ok) {
        failed = true;
        await this.deps.queue.update({ ...item, attempts: item.attempts + 1, lastError: 'network' });
      } else {
        await this.deps.queue.remove([item.id]);
      }
    }
    this.pendingCount = (await this.deps.queue.list()).length;
    this.phase = failed ? 'failed' : 'synced';
    this.emit();
    if (!failed) {
      this.confirmTimer = setTimeout(() => {
        this.phase = this.pendingCount ? 'pending' : 'idle';
        this.emit();
      }, this.deps.confirmationMs());
    }
    return this.status();
  }

  private async pushOne(item: OfflineQueueItem): Promise<boolean> {
    if (item.kind === 'attendance_submission') {
      const submission = await this.deps.attendance.getSubmissionById(item.recordId);
      if (!submission) return true; // nothing left to push
      const result = await this.deps.gateway.pushSubmission(submission);
      if (!result.ok) return false;
      await this.deps.attendance.markSubmissionSynced(submission.id, result.value.serverTimestamp);
      return true;
    }
    const record = await this.deps.staff.getById(item.recordId);
    if (!record) return true;
    const result = await this.deps.gateway.pushStaffRecord(record);
    if (!result.ok) return false;
    await this.deps.staff.markSynced(record.id);
    return true;
  }
}
