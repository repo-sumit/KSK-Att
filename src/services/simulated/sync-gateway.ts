/**
 * Simulated server for sync: accepts pushes after a short delay, or fails when
 * the demo says the next sync fails or the device is offline.
 */
import type { SyncGateway } from '@/repositories/interfaces';
import { err, ok } from '@/lib/result';
import type { Clock } from '@/lib/time';
import { simulatedDelay, type SimulationSource } from '../simulation';

export class SimulatedSyncGateway implements SyncGateway {
  constructor(private readonly sim: SimulationSource, private readonly clock: Clock) {}

  private async push() {
    await simulatedDelay(this.sim)(900);
    const s = this.sim.get();
    if (!s.online || s.nextSyncFails) return err('network' as const);
    return ok({ serverTimestamp: this.clock.now().toISOString() });
  }

  pushSubmission() {
    return this.push();
  }
  pushStaffRecord() {
    return this.push();
  }
}
