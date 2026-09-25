'use client';
import { useI18n } from '@/hooks/i18n';
import { useSession } from '@/hooks/session';
import type { SessionCard } from '@/services/attendance';
import { batchWithTrade, sessionMeta } from '../common/labels';

/** "Electrician · Shift 1 · Unit 2" plus "Period 3 · Theory" / "Morning" / subject when relevant. */
export function useSessionLabel() {
  const { t } = useI18n();
  const ctx = useSession();
  return (card: SessionCard) => {
    const subject = card.address.subjectId ? ctx.data.subjects.find((s) => s.id === card.address.subjectId)?.name : undefined;
    return { title: batchWithTrade(t, card.trade, card.batch), meta: sessionMeta(t, card, ctx.config.marking.twiceShape, subject) };
  };
}
