/**
 * ReportService — in-app reports computed from attendance records (PRD §19).
 * Returns structured data; screens format it in the user's language. Scope
 * follows the mapping model (§19.1); percentages count present = 1, half = 0.5.
 */
import type { ReportBlock, DateRangeKind } from '@/config/types';
import { effectiveMarks, type AttendanceSubmission, type Correction } from '@/domain/attendance';
import type { Batch, StaffMember, Student } from '@/domain/entities';
import { presenceWeight } from '@/domain/marking';
import type { StatusCode } from '@/domain/status';
import { compareDates, eachDate, startOfMonth, startOfWeek, toLocalDate, type LocalDate } from '@/lib/time';
import type { AttendanceRepository, CorrectionRepository, StaffAttendanceRepository } from '@/repositories/interfaces';
import type { SessionContext } from './context';
import type { CorrectionLogEntry, CorrectionService } from './corrections';

export interface DateRange {
  readonly kind: DateRangeKind;
  readonly from: LocalDate;
  readonly to: LocalDate;
}

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

export interface BatchStat {
  readonly batch: Batch;
  readonly tradeName: string;
  readonly students: number;
  readonly pct: number | null;
  readonly markedByName?: string;
}

export interface StudentStat {
  readonly student: Student;
  readonly pct: number | null;
  readonly daysPresent: number;
  readonly daysMarked: number;
}

export type ReportData =
  | { readonly block: 'my_attendance'; readonly days: ReadonlyArray<{ date: LocalDate; status: StatusCode | null; source?: string; at?: string }>; readonly present: number; readonly workingDays: number }
  | { readonly block: 'my_batches'; readonly batches: readonly BatchStat[]; readonly averagePct: number | null }
  | { readonly block: 'student_percentage'; readonly students: ReadonlyArray<StudentStat & { batch: Batch }>; readonly belowThreshold: number; readonly threshold: number }
  | { readonly block: 'daily_register'; readonly days: ReadonlyArray<{ date: LocalDate; batch: Batch; present: number; total: number; submitted: boolean }> }
  | { readonly block: 'institute_summary'; readonly trades: ReadonlyArray<{ tradeId: string; name: string; batches: number; students: number; pct: number | null }>; readonly pct: number | null; readonly students: number }
  | { readonly block: 'trade_batch'; readonly batches: readonly BatchStat[]; readonly lowest?: BatchStat }
  | { readonly block: 'staff_summary'; readonly staff: ReadonlyArray<{ member: StaffMember; present: number; workingDays: number }>; readonly pct: number | null }
  | { readonly block: 'correction_log'; readonly entries: readonly CorrectionLogEntry[] };

export class ReportService {
  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly corrections: CorrectionRepository,
    private readonly staff: StaffAttendanceRepository,
    private readonly correctionService: CorrectionService,
  ) {}

  rangeFor(ctx: SessionContext, kind: DateRangeKind, custom?: { from: LocalDate; to: LocalDate }): DateRange {
    const today = toLocalDate(ctx.clock.now());
    switch (kind) {
      case 'day':
        return { kind, from: today, to: today };
      case 'week':
        return { kind, from: startOfWeek(today), to: today };
      case 'month':
        return { kind, from: startOfMonth(today), to: today };
      case 'custom': {
        const from = custom?.from ?? startOfMonth(today);
        const to = custom && compareDates(custom.to, today) <= 0 ? custom.to : today;
        return { kind, from: compareDates(from, to) <= 0 ? from : to, to };
      }
    }
  }

  /** Batches this user's reports cover (PRD §19.1 and report.instructor_scope). */
  async batchesInScope(ctx: SessionContext): Promise<Batch[]> {
    if (ctx.journey.isPrincipal) return [...ctx.data.batches];
    const mapped = new Set(ctx.access.batchIds);
    if (ctx.access.tradeWideViewTradeId) ctx.data.batches.filter((b) => b.tradeId === ctx.access.tradeWideViewTradeId).forEach((b) => mapped.add(b.id));
    const scope = ctx.config.reports.instructorScope;
    const marked = new Set<string>();
    if (scope !== 'mapped') {
      const today = toLocalDate(ctx.clock.now());
      const subs = await this.attendance.listSubmissions({ from: startOfMonth(today), to: today });
      subs.filter((s) => s.markedBy === ctx.user.id).forEach((s) => marked.add(s.address.batchId));
    }
    const ids = scope === 'marked_only' ? marked : scope === 'mapped' ? mapped : new Set([...mapped, ...marked]);
    return ctx.data.batches.filter((b) => ids.has(b.id));
  }

  private async submissions(ctx: SessionContext, batchIds: readonly string[], range: DateRange): Promise<Array<{ sub: AttendanceSubmission; marks: Record<string, ReturnType<typeof effectiveMarks>[string]> }>> {
    const subs = (await this.attendance.listSubmissions({ batchIds, from: range.from, to: range.to }))
      // Reports use the batch's own daily/half/period records; subject sessions are reported separately.
      .filter((s) => (ctx.access.subjectId ? s.address.subjectId === ctx.access.subjectId : !s.address.subjectId));
    const corrections: Correction[] = await this.corrections.listForAttendance(subs.map((s) => s.id));
    return subs.map((sub) => ({ sub, marks: effectiveMarks(sub, corrections) }));
  }

  private batchStat(ctx: SessionContext, batch: Batch, rows: Awaited<ReturnType<ReportService['submissions']>>): BatchStat {
    let weight = 0;
    let count = 0;
    for (const { sub, marks } of rows) {
      if (sub.address.batchId !== batch.id) continue;
      for (const mark of Object.values(marks)) {
        weight += presenceWeight(mark);
        count++;
      }
    }
    const latest = rows.filter((r) => r.sub.address.batchId === batch.id).sort((a, b) => b.sub.address.date.localeCompare(a.sub.address.date))[0];
    return {
      batch,
      tradeName: ctx.data.trades.find((t) => t.id === batch.tradeId)?.name ?? '',
      students: ctx.data.students.filter((s) => s.batchId === batch.id).length,
      pct: pct(weight, count),
      markedByName: latest ? ctx.data.staff.find((s) => s.id === latest.sub.markedBy)?.name : undefined,
    };
  }

  async build(ctx: SessionContext, block: ReportBlock, range: DateRange, batchId?: string): Promise<ReportData> {
    const scopeBatches = await this.batchesInScope(ctx);
    switch (block) {
      case 'my_attendance': {
        const records = await this.staff.listBetween([ctx.user.id], range.from, range.to);
        const days = eachDate(range.from, range.to).reverse().map((date) => {
          const r = records.find((x) => x.date === date);
          return { date, status: r?.status ?? null, source: r?.source, at: r?.deviceTimestamp };
        }).filter((d) => d.status !== null || d.date === range.to);
        const present = records.filter((r) => r.status === 'present').length;
        return { block, days, present, workingDays: records.length };
      }
      case 'my_batches':
      case 'trade_batch': {
        const rows = await this.submissions(ctx, scopeBatches.map((b) => b.id), range);
        const stats = scopeBatches.map((b) => this.batchStat(ctx, b, rows));
        if (block === 'my_batches') {
          const valid = stats.filter((s) => s.pct !== null);
          const avg = valid.length ? Math.round(valid.reduce((a, s) => a + (s.pct ?? 0), 0) / valid.length) : null;
          return { block, batches: stats, averagePct: avg };
        }
        const lowest = [...stats].filter((s) => s.pct !== null).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))[0];
        return { block, batches: stats, lowest };
      }
      case 'student_percentage': {
        const batches = batchId ? scopeBatches.filter((b) => b.id === batchId) : scopeBatches;
        const threshold = ctx.config.reports.eligibilityThresholdPct;
        const rows = await this.submissions(ctx, batches.map((b) => b.id), range);
        const students = batches.flatMap((batch) =>
          ctx.data.students
            .filter((s) => s.batchId === batch.id)
            .map((student) => {
              let weight = 0;
              let marked = 0;
              for (const { sub, marks } of rows) {
                if (sub.address.batchId !== batch.id) continue;
                const m = marks[student.id];
                if (!m) continue;
                marked++;
                weight += presenceWeight(m);
              }
              return { student, batch, pct: pct(weight, marked), daysPresent: weight, daysMarked: marked };
            }),
        );
        students.sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
        return { block, students, belowThreshold: students.filter((s) => s.pct !== null && s.pct < threshold).length, threshold };
      }
      case 'daily_register': {
        const batches = batchId ? scopeBatches.filter((b) => b.id === batchId) : scopeBatches;
        const rows = await this.submissions(ctx, batches.map((b) => b.id), range);
        const days = eachDate(range.from, range.to)
          .reverse()
          .flatMap((date) =>
            batches.flatMap((batch) => {
              const total = ctx.data.students.filter((s) => s.batchId === batch.id).length;
              const day = rows.filter((r) => r.sub.address.date === date && r.sub.address.batchId === batch.id);
              if (!day.length) return date === range.to ? [{ date, batch, present: 0, total, submitted: false }] : [];
              const present = Object.values(day[0].marks).filter((m) => presenceWeight(m) > 0).length;
              return [{ date, batch, present, total, submitted: true }];
            }),
          );
        return { block, days };
      }
      case 'institute_summary': {
        const rows = await this.submissions(ctx, ctx.data.batches.map((b) => b.id), range);
        const trades = ctx.data.trades.map((t) => {
          const batches = ctx.data.batches.filter((b) => b.tradeId === t.id);
          const stats = batches.map((b) => this.batchStat(ctx, b, rows));
          const students = stats.reduce((a, s) => a + s.students, 0);
          const weighted = stats.filter((s) => s.pct !== null);
          const tradePct = weighted.length ? Math.round(weighted.reduce((a, s) => a + (s.pct ?? 0) * s.students, 0) / weighted.reduce((a, s) => a + s.students, 0)) : null;
          return { tradeId: t.id, name: t.name, batches: batches.length, students, pct: tradePct };
        });
        const students = trades.reduce((a, t) => a + t.students, 0);
        const withPct = trades.filter((t) => t.pct !== null);
        const overall = withPct.length ? Math.round(withPct.reduce((a, t) => a + (t.pct ?? 0) * t.students, 0) / withPct.reduce((a, t) => a + t.students, 0)) : null;
        return { block, trades, pct: overall, students };
      }
      case 'staff_summary': {
        const people = ctx.data.staff.filter((s) => s.role !== 'office_staff');
        const records = await this.staff.listBetween(people.map((p) => p.id), range.from, range.to);
        const staff = people.map((member) => {
          const mine = records.filter((r) => r.staffId === member.id);
          return { member, present: mine.filter((r) => r.status === 'present').length, workingDays: mine.length };
        });
        const present = staff.reduce((a, s) => a + s.present, 0);
        const days = staff.reduce((a, s) => a + s.workingDays, 0);
        return { block, staff, pct: pct(present, days) };
      }
      case 'correction_log':
        return { block, entries: await this.correctionService.log(ctx, range.from, range.to) };
    }
  }
}
