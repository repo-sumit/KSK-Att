/**
 * Mapping resolution (PRD §7, §13): which trades and batches a user can reach,
 * and which selection step the UI should show. Pure — the same function will
 * validate API responses once a backend exists.
 */
import type { AppConfiguration } from '@/config/types';
import type { BatchId, MasterData, StaffMember, SubjectId, TimetableEntry, TradeId } from './entities';
import { dayOfWeek, type LocalDate } from '@/lib/time';

/**
 * How the user narrows down to one teaching session:
 * - trade_picker:   pick any institute trade, then a batch (open mapping)
 * - trade_switcher: several mapped trades; batches of the chosen trade
 * - batch_list:     a fixed list of batches, grouped by trade (single trade, batch or special mapping)
 * - timetable:      today's timetabled periods; nothing to choose
 * - institute:      principal view of the whole institute
 */
export type SelectionMode = 'trade_picker' | 'trade_switcher' | 'batch_list' | 'timetable' | 'institute';

export interface AccessScope {
  readonly selection: SelectionMode;
  /** Trades in display order. */
  readonly tradeIds: readonly TradeId[];
  readonly batchIds: ReadonlySet<BatchId>;
  /** Sessions this user marks are for this cross-trade subject (e.g. Employability Skills). */
  readonly subjectId?: SubjectId;
  /** Today's timetable entries (timetable mapping only). */
  readonly timetable: readonly TimetableEntry[];
  /** Group instructors get a read-only trade-wide view of their primary trade (PRD §3.1). */
  readonly tradeWideViewTradeId?: TradeId;
  readonly canCorrect: boolean;
  readonly isInstituteWide: boolean;
}

function batchesOfTrades(data: MasterData, tradeIds: readonly TradeId[]): BatchId[] {
  const set = new Set(tradeIds);
  return data.batches.filter((b) => set.has(b.tradeId)).map((b) => b.id);
}

function tradesOfBatches(data: MasterData, batchIds: Iterable<BatchId>): TradeId[] {
  const wanted = new Set(batchIds);
  const seen = new Set<TradeId>();
  for (const trade of data.trades) {
    if (data.batches.some((b) => b.tradeId === trade.id && wanted.has(b.id))) seen.add(trade.id);
  }
  return data.trades.filter((t) => seen.has(t.id)).map((t) => t.id);
}

function mappedTrades(user: StaffMember, config: AppConfiguration): TradeId[] {
  if (!user.primaryTradeId) return [];
  const secondaryAllowed =
    config.mapping.multiTrade === 'all' || (config.mapping.multiTrade === 'named' && user.multiTradeAllowed);
  return secondaryAllowed ? [user.primaryTradeId, ...user.secondaryTradeIds] : [user.primaryTradeId];
}

export function resolveAccess(user: StaffMember, config: AppConfiguration, data: MasterData, date: LocalDate): AccessScope {
  const instituteTrades = data.trades.filter((t) => t.instituteId === user.instituteId).map((t) => t.id);
  const base = {
    timetable: [] as TimetableEntry[],
    subjectId: user.subjectId,
    tradeWideViewTradeId: user.role === 'group_instructor' ? user.primaryTradeId : undefined,
    canCorrect: false,
    isInstituteWide: false,
  };

  if (user.role === 'principal') {
    return {
      ...base,
      subjectId: undefined,
      selection: 'institute',
      tradeIds: instituteTrades,
      batchIds: new Set(batchesOfTrades(data, instituteTrades)),
      canCorrect: config.identity.principalCanCorrect,
      isInstituteWide: true,
    };
  }

  const special = Boolean(user.subjectId);
  switch (config.mapping.model) {
    case 'open':
      return { ...base, selection: 'trade_picker', tradeIds: instituteTrades, batchIds: new Set(batchesOfTrades(data, instituteTrades)) };

    case 'trade': {
      if (special) {
        const batchIds = config.mapping.allBatchInstructors ? batchesOfTrades(data, instituteTrades) : [...user.batchIds];
        return { ...base, selection: 'batch_list', tradeIds: tradesOfBatches(data, batchIds), batchIds: new Set(batchIds) };
      }
      const trades = mappedTrades(user, config);
      const single = trades.length === 1 && config.mapping.tradeAutoselect;
      return { ...base, selection: single ? 'batch_list' : 'trade_switcher', tradeIds: trades, batchIds: new Set(batchesOfTrades(data, trades)) };
    }

    case 'batch':
      return { ...base, selection: 'batch_list', tradeIds: tradesOfBatches(data, user.batchIds), batchIds: new Set(user.batchIds) };

    case 'timetable': {
      const weekday = dayOfWeek(date);
      const entries = data.timetable
        .filter((t) => t.instructorId === user.id && t.weekday === weekday)
        .sort((a, b) => a.window.start.localeCompare(b.window.start));
      const batchIds = [...new Set(entries.map((e) => e.batchId))];
      // Period marking shows the day's periods; daily/twice marking shows the assigned batches (PRD §7.3).
      const selection: SelectionMode = config.marking.frequency === 'period' ? 'timetable' : 'batch_list';
      return { ...base, selection, tradeIds: tradesOfBatches(data, batchIds), batchIds: new Set(batchIds), timetable: entries };
    }
  }
}

export function canMarkBatch(scope: AccessScope, batchId: BatchId): boolean {
  return scope.batchIds.has(batchId);
}
