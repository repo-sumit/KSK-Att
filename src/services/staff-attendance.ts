/**
 * StaffAttendanceService — instructor presence (PRD §18): self-marking after
 * the same verification as student marking, and principal marking that only
 * fills gaps. One record per person per day; records lock once made.
 */
import type { StaffAttendanceRecord } from '@/domain/attendance';
import type { StaffMember } from '@/domain/entities';
import { checkStaffMark, type StaffMarkError } from '@/domain/rules';
import type { StatusCode } from '@/domain/status';
import { createId } from '@/lib/ids';
import { err, ok, type Result } from '@/lib/result';
import { toLocalDate } from '@/lib/time';
import type { OfflineQueueRepository, StaffAttendanceRepository, VerificationRepository } from '@/repositories/interfaces';
import type { SessionContext } from './context';
import { purposeKey } from './verification';

export interface StaffDayRow {
  readonly member: StaffMember;
  readonly record?: StaffAttendanceRecord;
}

export class StaffAttendanceService {
  constructor(
    private readonly records: StaffAttendanceRepository,
    private readonly passes: VerificationRepository,
    private readonly queue: OfflineQueueRepository,
    private readonly onRecordQueued: () => void,
  ) {}

  async myRecord(ctx: SessionContext): Promise<StaffAttendanceRecord | undefined> {
    return this.records.get(ctx.user.id, toLocalDate(ctx.clock.now()));
  }

  /** PRD §18.3: every instructor at the institute, plus the principal. */
  async day(ctx: SessionContext): Promise<StaffDayRow[]> {
    const today = toLocalDate(ctx.clock.now());
    const people = ctx.data.staff.filter((s) => s.role !== 'office_staff');
    const records = await this.records.listForDate(today);
    return people.map((member) => ({ member, record: records.find((r) => r.staffId === member.id) }));
  }

  private async write(ctx: SessionContext, record: StaffAttendanceRecord): Promise<Result<StaffAttendanceRecord, StaffMarkError>> {
    const created = await this.records.create(record);
    if (!created.ok) return err(created.error);
    await this.queue.enqueue({ id: createId('q'), kind: 'staff_attendance', recordId: record.id, label: record.staffId, enqueuedAt: record.deviceTimestamp, attempts: 0 });
    this.onRecordQueued();
    return ok(record);
  }

  async markSelf(ctx: SessionContext): Promise<Result<StaffAttendanceRecord, StaffMarkError>> {
    const today = toLocalDate(ctx.clock.now());
    const pass = ctx.journey.verification.required ? await this.passes.find(ctx.user.id, purposeKey({ kind: 'self' }), today) : undefined;
    const check = checkStaffMark({
      actor: ctx.user,
      target: ctx.user,
      source: 'self',
      existing: await this.records.get(ctx.user.id, today),
      date: today,
      today,
      status: 'present',
      config: ctx.config,
      verificationRequired: ctx.journey.verification.required,
      verified: Boolean(pass),
    });
    if (!check.ok) return check;
    return this.write(ctx, {
      id: createId('staff'),
      staffId: ctx.user.id,
      date: today,
      status: 'present',
      source: 'self',
      markedBy: ctx.user.id,
      deviceTimestamp: ctx.clock.now().toISOString(),
      ...(pass?.location ? { location: pass.location } : {}),
      syncState: 'pending',
    });
  }

  /**
   * Saves the principal's marks for people with no record yet. Every row is
   * checked first; rows that became self-marked meanwhile are skipped, never
   * overwritten (self-mark precedence, PRD §18.3).
   */
  async markByPrincipal(
    ctx: SessionContext,
    entries: ReadonlyArray<{ staffId: string; status: StatusCode }>,
  ): Promise<Result<{ saved: number; skipped: string[] }, StaffMarkError | 'unknown_staff'>> {
    const today = toLocalDate(ctx.clock.now());
    const valid: Array<{ target: StaffMember; status: StatusCode }> = [];
    const skipped: string[] = [];
    for (const entry of entries) {
      const target = ctx.data.staff.find((s) => s.id === entry.staffId);
      if (!target) return err('unknown_staff');
      const check = checkStaffMark({
        actor: ctx.user,
        target,
        source: 'principal',
        existing: await this.records.get(target.id, today),
        date: today,
        today,
        status: entry.status,
        config: ctx.config,
        verificationRequired: false,
        verified: true,
      });
      if (check.ok) valid.push({ target, status: entry.status });
      else if (check.error === 'already_marked') skipped.push(target.id);
      else return check;
    }
    let saved = 0;
    for (const { target, status } of valid) {
      const written = await this.write(ctx, {
        id: createId('staff'),
        staffId: target.id,
        date: today,
        status,
        source: 'principal',
        markedBy: ctx.user.id,
        deviceTimestamp: ctx.clock.now().toISOString(),
        syncState: 'pending',
      });
      if (written.ok) saved++;
      else skipped.push(target.id);
    }
    return ok({ saved, skipped });
  }
}
