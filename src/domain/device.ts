/**
 * Device-held records: downloaded batch packs (PRD §20.1) and face enrolment.
 */
import type { BatchId, StaffId } from './entities';

/** A roster + context downloaded for offline marking. */
export interface BatchPack {
  readonly batchId: BatchId;
  /** ISO timestamp of the last download or refresh. */
  readonly downloadedAt: string;
}

export function isPackStale(pack: BatchPack, now: Date, refreshDays: number): boolean {
  return now.getTime() - new Date(pack.downloadedAt).getTime() > refreshDays * 86_400_000;
}

/**
 * Enrolled face reference. SIMULATION ONLY in this build: no image is captured,
 * stored or matched — the record just says enrolment happened (see docs/DECISIONS.md).
 */
export interface FaceEnrolment {
  readonly staffId: StaffId;
  readonly enrolledAt: string;
  readonly sampleCount: number;
  readonly simulated: true;
}
