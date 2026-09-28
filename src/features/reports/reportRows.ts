/**
 * Detail reports (staff attendance, correction log): structured ReportData as
 * stacked mobile rows (title / subtitle / value chip) and a one-line summary,
 * translated at render time. The Reports page itself is built from sections.
 */
import type { IconName } from '@/components/ui/icons/Icon';
import type { Tone } from '@/components/ui/Badge';
import type { I18n, MessageKey } from '@/i18n';
import type { SessionContext } from '@/services/context';
import type { DateRange, DetailBlock, ReportData } from '@/services/reports';
import { toLocalDate } from '@/lib/time';
import { batchWithTrade, correctionReason, markLabel } from '../common/labels';

/** Staff presence below this share is flagged amber (no PRD value; display-only). */
const STAFF_THRESHOLD = 90;

export const DETAIL_META: Readonly<Record<DetailBlock, { icon: IconName; title: MessageKey; desc: MessageKey }>> = {
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

const pctTone = (pct: number | null, threshold: number): Pick<ReportRow, 'tone' | 'icon'> =>
  pct === null ? { tone: 'neutral', icon: 'circle' } : pct < threshold ? { tone: 'warning', icon: 'alert' } : { tone: 'success', icon: 'check' };

export function buildReport(t: T, f: F, ctx: SessionContext, data: ReportData, range: DateRange): { summary: string; rows: ReportRow[] } {
  const r = rangeLabel(t, f, range);
  const label = (batchId: string) => {
    const batch = ctx.data.batches.find((b) => b.id === batchId);
    const trade = batch && ctx.data.trades.find((x) => x.id === batch.tradeId);
    return batch && trade ? batchWithTrade(t, trade, batch) : batchId;
  };
  switch (data.block) {
    case 'staff_summary':
      return {
        summary: t('reports.sumStaff', { range: r, pct: data.pct ?? 0, count: data.staff.length }),
        rows: data.staff.map((s) => ({
          id: s.member.id,
          title: s.member.name,
          subtitle: t(`role.${s.member.role}`),
          ...pctTone(s.workingDays ? Math.round((s.present / s.workingDays) * 100) : null, STAFF_THRESHOLD),
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
