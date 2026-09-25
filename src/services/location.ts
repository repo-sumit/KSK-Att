/**
 * LocationVerificationService: where the device is, and whether that satisfies
 * the configured geo mode (PRD §8.1–8.2). Implementations:
 *  - SimulatedLocationProvider (services/simulated) — demo outcomes, no GPS needed
 *  - BrowserLocationProvider (below) — the real Geolocation API
 */
import type { CapturedLocation } from '@/domain/attendance';
import type { GeoPoint } from '@/domain/entities';
import { evaluateFence } from '@/domain/geo';
import { err, ok, type Result } from '@/lib/result';
import type { PermissionState } from './simulation';

export interface DevicePosition extends GeoPoint {
  readonly accuracyM: number;
}

export type PositionError = 'permission_denied' | 'unavailable' | 'timeout';

export interface LocationProvider {
  permission(): Promise<PermissionState>;
  /** Triggers the OS permission prompt where the platform has one. */
  requestPermission(): Promise<PermissionState>;
  /** `near` is the institute being checked against (simulations position themselves relative to it). */
  currentPosition(near: GeoPoint): Promise<Result<DevicePosition, PositionError>>;
}

export type LocationCheckError = PositionError | 'outside_fence';

export interface LocationCheck {
  readonly location: CapturedLocation;
  readonly inside: boolean;
}

/** Geo-tagging just records the position; geo-fencing also gates on distance. */
export async function checkLocation(
  provider: LocationProvider,
  mode: 'tagging' | 'fencing',
  institute: GeoPoint,
  radiusM: number,
): Promise<Result<LocationCheck, LocationCheckError>> {
  const position = await provider.currentPosition(institute);
  if (!position.ok) return position;
  const { lat, lng, accuracyM } = position.value;
  if (mode === 'tagging') return ok({ location: { lat, lng, accuracyM }, inside: true });
  const fence = evaluateFence(position.value, institute, radiusM);
  const location = { lat, lng, accuracyM, distanceM: fence.distanceM };
  // INV-17: there is no override — outside the radius never yields a pass.
  return fence.inside ? ok({ location, inside: true }) : err('outside_fence', { distanceM: fence.distanceM });
}

export class BrowserLocationProvider implements LocationProvider {
  async permission(): Promise<PermissionState> {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      return status.state === 'granted' ? 'granted' : status.state === 'denied' ? 'denied' : 'prompt';
    } catch {
      return 'prompt';
    }
  }
  async requestPermission(): Promise<PermissionState> {
    const result = await this.currentPosition();
    if (result.ok) return 'granted';
    return result.error === 'permission_denied' ? 'denied' : 'prompt';
  }
  currentPosition(): Promise<Result<DevicePosition, PositionError>> {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(err('unavailable'));
      navigator.geolocation.getCurrentPosition(
        (p) => resolve(ok({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: Math.round(p.coords.accuracy) })),
        (e) => resolve(err(e.code === e.PERMISSION_DENIED ? 'permission_denied' : e.code === e.TIMEOUT ? 'timeout' : 'unavailable')),
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
      );
    });
  }
}
