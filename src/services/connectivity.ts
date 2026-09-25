/**
 * ConnectivityService — whether the device can reach the server. The demo
 * drives it from the panel; production uses the browser's online/offline events.
 */
import type { SimulationSource } from './simulation';

export interface ConnectivityService {
  isOnline(): boolean;
  subscribe(listener: (online: boolean) => void): () => void;
}

export class SimulatedConnectivity implements ConnectivityService {
  constructor(private readonly sim: SimulationSource) {}
  isOnline() {
    return this.sim.get().online;
  }
  subscribe(listener: (online: boolean) => void) {
    let last = this.isOnline();
    return this.sim.subscribe(() => {
      const now = this.isOnline();
      if (now !== last) {
        last = now;
        listener(now);
      }
    });
  }
}

export class BrowserConnectivity implements ConnectivityService {
  isOnline() {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }
  subscribe(listener: (online: boolean) => void) {
    const on = () => listener(true);
    const off = () => listener(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }
}
