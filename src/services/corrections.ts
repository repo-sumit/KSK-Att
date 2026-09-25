/**
 * CorrectionService — the principal's same-day correction right (PRD §12.2):
 * today only, reason required, every change appended to the audit log. The
 * original submission is never modified.
 */
import type { Correction, CorrectionReasonCode, SessionKey } from '@/domain/attendance';
import { effectiveMarks } from '@/domain/attendance';
import { checkCorrection, type CorrectionError } from '@/domain/rules';
import type { Mark } from '@/domain/status';
import { createId } from '@/lib/ids';
import { err, ok, type Result } from '@/lib/result';
import { toLocalDate, type LocalDate } from '@/lib/time';
import type { AttendanceRepository, CorrectionRepository } from '@/repositories/interfaces';
import type { SessionContext } from './context';

export interface CorrectionLogEntry extends Correction {
  readonly studentName: string;
  readonly batchId: string;
  readonly actorName: string;
}

export class CorrectionService {
  constructor(private readonly attendance: AttendanceRepository, private readonly corrections: CorrectionRepository) {}

  async correct(
    ctx: SessionContext,
    key: SessionKey,
    studentId: string,
    newMark: Mark,
    reason: string,
    reasonCode?: CorrectionReasonCode,
  ): Promise<Result<Correction, CorrectionError | 'unknown_session'>> {
    const submission = await this.attendance.getSubmission(key);
    if (!submission) return err('unknown_session');
    const previous = await this.corrections.listForAttendance([submission.id]);
    const current = effectiveMarks(submission, previous)[studentId];
    const check = checkCorrection({
      actor: ctx.user,
      config: ctx.config,
      submission,
      studentId,
      currentMark: current,
      newMark,
      reason,
      today: toLocalDate(ctx.clock.now()),
    });
    if (!check.ok) return check;
    const correction: Correction = {
      correctionId: createId('corr'),
      attendanceId: submission.id,
      studentId,
      oldMark: current,
      newMark,
      reason: reason.trim(),
      ...(reasonCode ? { reasonCode } : {}),
      actorId: ctx.user.id,
      timestamp: ctx.clock.now().toISOString(),
    };
    await this.corrections.append(correction);
    return ok(correction);
  }

  async log(ctx: SessionContext, from: LocalDate, to: LocalDate): Promise<CorrectionLogEntry[]> {
    const entries = await this.corrections.listBetween(from, to);
    return entries
      .map((c) => {
        const student = ctx.data.students.find((s) => s.id === c.studentId);
        return {
          ...c,
          studentName: student?.name ?? c.studentId,
          batchId: student?.batchId ?? '',
          actorName: ctx.data.staff.find((s) => s.id === c.actorId)?.name ?? c.actorId,
        };
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
}
