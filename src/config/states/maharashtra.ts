/**
 * Maharashtra state instance — the configuration sheet for this deployment
 * (PRD §17). Only keys listed in `overridableKeys` may be changed by a district
 * or institute layer (PRD §5.1).
 */
import { PRODUCT_DEFAULTS } from '../defaults';
import type { StateConfiguration } from '../types';

export const MAHARASHTRA: StateConfiguration = {
  stateId: 'mh',
  stateName: 'Maharashtra',
  base: {
    ...PRODUCT_DEFAULTS,
    mapping: { ...PRODUCT_DEFAULTS.mapping, model: 'open' },
    verification: { ...PRODUCT_DEFAULTS.verification, geoMode: 'fencing', fenceRadiusM: 500, face: true },
    marking: { ...PRODUCT_DEFAULTS.marking, defaultStatus: 'present' },
    time: { ...PRODUCT_DEFAULTS.time, fencing: true, instituteOverride: true },
    staff: { ...PRODUCT_DEFAULTS.staff, enabled: true },
    reports: {
      ...PRODUCT_DEFAULTS.reports,
      blocks: [
        'my_attendance',
        'my_batches',
        'student_percentage',
        'institute_summary',
        'trade_batch',
        'staff_summary',
        'correction_log',
      ],
      dateRanges: ['day', 'week', 'month', 'custom'],
    },
    offline: { ...PRODUCT_DEFAULTS.offline, enabled: true },
    announcements: { enabled: true },
    // Latin digits in Marathi: decided with the product owner (docs/DECISIONS.md D-012).
    i18n: { languages: ['en', 'mr'], defaultLanguage: 'en', userSwitch: true, fallback: 'en', numerals: 'latin' },
    // Voice stays off at the state floor: an institute layer (voice.enabled is overridable) or a demo preset switches it on.
    voice: { ...PRODUCT_DEFAULTS.voice, languages: ['en', 'mr'] },
  },
  overridableKeys: ['time.shiftWindows', 'verification.fenceRadiusM', 'voice.enabled'],
};
