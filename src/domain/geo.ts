/**
 * Geo-fence evaluation (PRD §8.1–8.2). The distance is computed on the device
 * against the institute coordinates, so the gate also works offline (§16.1).
 */
import type { GeoPoint } from './entities';

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface FenceResult {
  readonly inside: boolean;
  readonly distanceM: number;
}

export function evaluateFence(position: GeoPoint, institute: GeoPoint, radiusM: number): FenceResult {
  const distanceM = distanceMeters(position, institute);
  return { inside: distanceM <= radiusM, distanceM };
}

/** PRD §8.2: metres under 1 km, kilometres (two decimals) above it. */
export function distanceParts(distanceM: number): { value: number; unit: 'm' | 'km' } {
  const metres = Math.round(distanceM);
  if (metres < 1000) return { value: metres, unit: 'm' };
  return { value: Math.round(metres / 10) / 100, unit: 'km' };
}

/** Moves a point roughly `meters` north-east — used by demo simulations of "outside the fence". */
export function offsetPoint(origin: GeoPoint, meters: number): GeoPoint {
  const d = meters / Math.SQRT2;
  const dLat = d / 111_320;
  const dLng = d / (111_320 * Math.cos(toRad(origin.lat)));
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}
