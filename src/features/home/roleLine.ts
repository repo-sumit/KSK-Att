import type { I18n } from '@/i18n';
import type { SessionContext } from '@/services/context';

/** "Instructor · Electrician", "Group Instructor · Electrician", "Principal". */
export function roleLine(t: I18n['t'], ctx: SessionContext): string {
  const role = t(`role.${ctx.user.role}`);
  const subject = ctx.data.subjects.find((s) => s.id === ctx.user.subjectId)?.name;
  const trade = ctx.data.trades.find((x) => x.id === ctx.user.primaryTradeId)?.name;
  const specialty = subject ?? trade;
  return specialty && ctx.journey.homeVariant === 'instructor' ? t('role.withTrade', { role, trade: specialty }) : role;
}
