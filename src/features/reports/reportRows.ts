/**
 * Turns structured ReportData into stacked mobile rows (title / subtitle /
 * value chip) and a one-line summary — translated at render time.
 */
import type { ReportBlock } from '@/config/types';
import type { IconName } from '@/components/ui/icons/Icon';
import type { Tone } from '@/components/ui/Badge';
import type { I18n, MessageKey } from '@/i18n';
import type { SessionContext } from '@/services/context';
import type { DateRange, ReportData } from '@/services/reports';
import { toLocalDate } from '@/lib/time';
import { batchWithTrade, correctionReason, markLabel } from '../common/labels';

/** Staff presence below this share is flagged amber (no PRD value; display-only). */
const STAFF_THRESHOLD = 90;

export const REPORT_META: Readonly<Record<ReportBlock, { icon: IconName; title: MessageKey; desc: MessageKey }>> = {
  my_attendance: { icon: 'calendar', title: 'reports.my_attendance', desc: 'reports.my_attendance_desc' },
  my_batches: { icon: 'users', title: 'reports.my_batches', desc: 'reports.my_batches_desc' },
  student_percentage: { icon: 'chart', title: 'reports.student_percentage', desc: 'reports.student_percentage_desc' },
  daily_register: { icon: 'file-text', title: 'reports.daily_register', desc: 'reports.daily_register_desc' },
  institute_summary: { icon: 'building', title: 'reports.institute_summary', desc: 'reports.institute_summary_desc' },
  trade_batch: { icon: 'users', title: 'reports.trade_batch', desc: 'reports.trade_batch_desc' },
  staff_summary: { icon: 'user-check', title: 'reports.staff_summary', desc: 'reports.staff_summary_desc' },
  correction_log: { icon: 'history', title: 'reports.correction_log', desc: 'reports.correction_log_desc' },
};

export interface ReportRow {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly value: string;
  readonly tone: Tone;
  readonly icon: IconName;
}

type T = I18n['t'];
type F = I18n['format'];

export function rangeLabel(t: T, f: F, range: DateRange): string {
  switch (range.kind) {
    case 'day':
      return t('reports.labelDay');
    case 'week':
      return t('reports.labelWeek');
    case 'month':
      return t('reports.labelMonth');
    case 'custom':
      return t('reports.labelCustom', { from: f.dayMonth(range.from), to: f.dayMonth(range.to) });
  }
}

const pctRow = (pct: number | null, threshold: number): Pick<ReportRow, 'value' | 'tone' | 'icon'> =>
  pct === null ? { value: '—', tone: 'neutral', icon: 'circle' } : pct < threshold ? { value: `${pct}%`, tone: 'warning', icon: 'alert' } : { value: `${pct}%`, tone: 'success', icon: 'check' };

export function buildReport(t: T, f: F, ctx: SessionContext, data: ReportData, range: DateRange): { summary: string; rows: ReportRow[] } {
  const r = rangeLabel(t, f, range);
  const threshold = ctx.config.reports.eligibilityThresholdPct;
  const tradeOf = (tradeId: string) => ctx.data.trades.find((x) => x.id === tradeId);
  const label = (batchId: string) => {
    const batch = ctx.data.batches.find((b) => b.id === batchId);
    const trade = batch && tradeOf(batch.tradeId);
    return batch && trade ? batchWithTrade(t, trade, batch) : batchId;
  };
  switch (data.block) {
    case 'my_attendance':
      return {
        summary: t('reports.sumMyAttendance', { range: r, present: data.present, days: data.workingDays }),
        rows: data.days.map((d) => ({
          id: d.date,
          title: f.shortDate(d.date),
          subtitle: !d.status ? t('reports.notMarked') : d.source === 'self' && d.at ? t('reports.selfVerifiedAt', { time: f.time(d.at) }) : t('reports.markedByPrincipal'),
          value: d.status ? markLabel(t, { status: d.status }) : t('reports.notMarked'),
          tone: d.status === 'present' ? 'success' : d.status ? 'error' : 'neutral',
          icon: d.status === 'present' ? 'check' : d.status ? 'x' : 'circle',
        })),
      };
    case 'my_batches':
      return {
        summary: t('reports.sumMyBatches', { range: r, count: data.batches.length, pct: data.averagePct ?? 0 }),
        rows: data.batches.map((b) => ({ id: b.batch.id, title: label(b.batch.id), subtitle: t('common.students', { count: b.students }), ...pctRow(b.pct, threshold) })),
      };
    case 'student_percentage':
      return {
        summary: t('reports.sumStudents', { range: r, count: data.belowThreshold, pct: data.threshold }),
        rows: data.students.map((s) => ({ id: s.student.id, title: s.student.name, subtitle: label(s.batch.id), ...pctRow(s.pct, threshold) })),
      };
    case 'daily_register':
      return {
        summary: t('reports.sumDaily', { range: r, count: new Set(data.days.map((d) => d.batch.id)).size }),
        rows: data.days.map((d) => ({
          id: `${d.date}-${d.batch.id}`,
          title: f.shortDate(d.date),
          subtitle: label(d.batch.id),
          value: d.submitted ? t('reports.presentOfTotal', { present: d.present, total: d.total }) : t('reports.notSubmitted'),
          tone: d.submitted ? 'success' : 'neutral',
          icon: d.submitted ? 'check' : 'circle',
        })),
      };
    case 'institute_summary':
      return {
        summary: t('reports.sumInstitute', { range: r, pct: data.pct ?? 0, students: data.students }),
        rows: data.trades.map((tr) => ({ id: tr.tradeId, title: tr.name, subtitle: t('reports.batchesStudents', { batches: tr.batches, students: tr.students }), ...pctRow(tr.pct, threshold) })),
      };
    case 'trade_batch':
      return {
        summary: data.lowest ? t('reports.sumTrade', { range: r, batch: label(data.lowest.batch.id), pct: data.lowest.pct ?? 0 }) : r,
        rows: data.batches.map((b) => ({ id: b.batch.id, title: label(b.batch.id), subtitle: b.markedByName ?? '—', ...pctRow(b.pct, threshold) })),
      };
    case 'staff_summary':
      return {
        summary: t('reports.sumStaff', { range: r, pct: data.pct ?? 0, count: data.staff.length }),
        rows: data.staff.map((s) => ({
          id: s.member.id,
          title: s.member.name,
          subtitle: t(`role.${s.member.role}`),
          ...pctRow(s.workingDays ? Math.round((s.present / s.workingDays) * 100) : null, STAFF_THRESHOLD),
          value: t('reports.daysPresent', { present: s.present, days: s.workingDays }),
        })),
      };
    case 'correction_log':
      return {
        summary: t('reports.sumCorrections', { range: r, count: data.entries.length }),
        rows: data.entries.map((e) => ({
          id: e.correctionId,
          title: t('reports.correctionRow', { student: e.studentName, from: markLabel(t, e.oldMark), to: markLabel(t, e.newMark) }),
          subtitle: t('reports.correctionSub', { session: label(e.batchId), reason: correctionReason(t, e), by: e.actorName, when: `${f.dayMonth(toLocalDate(new Date(e.timestamp)))} · ${f.time(e.timestamp)}` }),
          value: t('reports.logged'),
          tone: 'neutral',
          icon: 'history',
        })),
      };
  }
}
