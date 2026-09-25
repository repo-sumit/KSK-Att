/**
 * DemoLocationVerificationService provider: reports a position consistent with
 * the chosen demo outcome (inside / outside / denied / unavailable), or defers
 * to the device's real GPS when the presenter picks "Use this phone's GPS".
 */
import type { GeoPoint } from '@/domain/entities';
import { offsetPoint } from '@/domain/geo';
import { err, ok } from '@/lib/result';
import { BrowserLocationProvider, type LocationProvider } from '../location';
import { simulatedDelay, type SimulationSource } from '../simulation';

export class SimulatedLocationProvider implements LocationProvider {
  private readonly browser = new BrowserLocationProvider();

  constructor(private readonly sim: SimulationSource) {}

  async permission() {
    return this.sim.get().permissions.location;
  }

  async requestPermission() {
    const state = this.sim.get();
    const granted = state.location === 'permission_denied' ? 'denied' : 'granted';
    this.sim.update({ permissions: { ...state.permissions, location: granted } });
    return granted;
  }

  async currentPosition(near: GeoPoint) {
    const state = this.sim.get();
    if (state.location === 'device_gps') return this.browser.currentPosition();
    await simulatedDelay(this.sim)(1600);
    if (state.permissions.location === 'denied' || state.location === 'permission_denied') return err('permission_denied');
    if (state.location === 'unavailable') return err('unavailable');
    const point = state.location === 'outside' ? offsetPoint(near, state.outsideDistanceM) : offsetPoint(near, 60);
    return ok({ ...point, accuracyM: 12 });
  }
}
