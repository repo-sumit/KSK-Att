/**
 * BatchPackService — offline batch packs (PRD §20.1–20.3). Download scope is
 * derived from the same mapping as online marking, so the offline section can
 * never expose a batch the user could not mark online (INV-25).
 */
import { isPackStale, type BatchPack } from '@/domain/device';
import type { Batch, Trade } from '@/domain/entities';
import { err, ok, type Result } from '@/lib/result';
import type { BatchPackRepository } from '@/repositories/interfaces';
import type { ConnectivityService } from './connectivity';
import type { SessionContext } from './context';

export interface PackRow {
  readonly batch: Batch;
  readonly trade: Trade;
  readonly pack: BatchPack;
  readonly stale: boolean;
}

export class BatchPackService {
  constructor(private readonly packs: BatchPackRepository, private readonly connectivity: ConnectivityService) {}

  private inScope(ctx: SessionContext, batchId: string): boolean {
    return ctx.journey.isPrincipal || ctx.access.batchIds.has(batchId);
  }

  async list(ctx: SessionContext): Promise<PackRow[]> {
    const now = ctx.clock.now();
    const packs = await this.packs.list();
    return packs
      .filter((p) => this.inScope(ctx, p.batchId))
      .flatMap((pack) => {
        const batch = ctx.data.batches.find((b) => b.id === pack.batchId);
        const trade = batch && ctx.data.trades.find((t) => t.id === batch.tradeId);
        return batch && trade ? [{ batch, trade, pack, stale: isPackStale(pack, now, ctx.config.offline.refreshDays) }] : [];
      })
      .sort((a, b) => a.trade.name.localeCompare(b.trade.name) || a.batch.shift - b.batch.shift || a.batch.unit - b.batch.unit);
  }

  /** Batches the user may download, i.e. exactly the ones they can reach online. */
  downloadable(ctx: SessionContext): Batch[] {
    return ctx.data.batches.filter((b) => this.inScope(ctx, b.id));
  }

  async download(ctx: SessionContext, batchIds: readonly string[]): Promise<Result<number, 'offline' | 'no_access' | 'too_many'>> {
    if (!this.connectivity.isOnline()) return err('offline');
    if (batchIds.some((id) => !this.inScope(ctx, id))) return err('no_access');
    const max = ctx.config.offline.maxBatches;
    const existing = (await this.packs.list()).filter((p) => this.inScope(ctx, p.batchId)).map((p) => p.batchId);
    if (max !== null && new Set([...existing, ...batchIds]).size > max) return err('too_many');
    const at = ctx.clock.now().toISOString();
    await this.packs.upsert(batchIds.map((batchId) => ({ batchId, downloadedAt: at })));
    return ok(batchIds.length);
  }

  /** Manual refresh pulls current data for every pack held (PRD §20.3). */
  async refreshAll(ctx: SessionContext): Promise<Result<number, 'offline'>> {
    if (!this.connectivity.isOnline()) return err('offline');
    const rows = await this.list(ctx);
    const at = ctx.clock.now().toISOString();
    await this.packs.upsert(rows.map((r) => ({ batchId: r.batch.id, downloadedAt: at })));
    return ok(rows.length);
  }
}
