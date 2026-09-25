'use client';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import type { BatchGroup, SessionCard } from '@/services/attendance';

const TOPICS = ['attendance', 'corrections', 'offline', 'packs'] as const;

export interface TradeSummary {
  readonly id: string;
  readonly name: string;
  readonly batches: number;
  /** Institute view: submitted / opened sessions today. */
  readonly progress?: { readonly done: number; readonly total: number };
}

export type Board =
  | { readonly kind: 'trades'; readonly trades: readonly TradeSummary[] }
  | { readonly kind: 'groups'; readonly groups: readonly BatchGroup[] }
  | { readonly kind: 'periods'; readonly cards: readonly SessionCard[] }
  | { readonly kind: 'switcher'; readonly groups: readonly BatchGroup[] };

/** Loads what the Attendance tab shows, driven only by the journey's selection mode. */
export function useBoard() {
  const ctx = useSession();
  const { attendance } = useServices();
  return useQuery<Board>(
    `board:${ctx.user.id}:${ctx.journey.selection}`,
    async () => {
      switch (ctx.journey.selection) {
        case 'timetable':
          return { kind: 'periods', cards: await attendance.timetableBoard(ctx) };
        case 'batch_list':
          return { kind: 'groups', groups: await attendance.myBoard(ctx) };
        case 'trade_switcher':
          return { kind: 'switcher', groups: await attendance.myBoard(ctx) };
        case 'trade_picker':
          return {
            kind: 'trades',
            trades: ctx.access.tradeIds.map((id) => {
              const trade = ctx.data.trades.find((x) => x.id === id);
              return { id, name: trade?.name ?? id, batches: ctx.data.batches.filter((b) => b.tradeId === id).length };
            }),
          };
        case 'institute': {
          const trades = await Promise.all(
            ctx.access.tradeIds.map(async (id) => {
              const cards = (await attendance.boardForTrade(ctx, id)).filter((c) => !c.address.subjectId);
              const opened = cards.filter((c) => c.status !== 'future');
              const done = cards.filter((c) => c.status === 'submitted').length;
              const trade = ctx.data.trades.find((x) => x.id === id);
              return { id, name: trade?.name ?? id, batches: cards.length, progress: { done, total: opened.length || cards.length } };
            }),
          );
          return { kind: 'trades', trades };
        }
      }
    },
    TOPICS,
  );
}
