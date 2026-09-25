/** Shared test fixtures built from the real demo dataset. */
import { MAHARASHTRA } from '@/config/states/maharashtra';
import { resolveConfiguration } from '@/config/resolve';
import type { AppConfiguration, ConfigLayer } from '@/config/types';
import { buildMasterData } from '@/data/mock/seeds';
import type { MasterData, StaffMember } from '@/domain/entities';

export const TODAY = '2026-09-25'; // a Friday
export const data: MasterData = buildMasterData(TODAY);

export const configWith = (overrides: ConfigLayer = {}): AppConfiguration =>
  resolveConfiguration({ state: MAHARASHTRA, demoOverrides: overrides });

export function staff(id: string): StaffMember {
  const s = data.staff.find((m) => m.id === id);
  if (!s) throw new Error(`No staff ${id}`);
  return s;
}
