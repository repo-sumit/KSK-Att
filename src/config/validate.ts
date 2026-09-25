/**
 * Configuration-set validation (PRD §14.6). Invalid combinations are rejected,
 * never silently resolved. Warnings flag combinations the PRD calls risky.
 */
import type { MasterData } from '@/domain/entities';
import type { AppConfiguration } from './types';

export interface ValidationIssue {
  readonly severity: 'error' | 'warning';
  readonly code: string;
  readonly message: string;
}

export interface ValidationContext {
  readonly data: MasterData;
  readonly enrolledFaceCount: number;
}

export function validateConfiguration(config: AppConfiguration, ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (severity: ValidationIssue['severity'], code: string, message: string) => issues.push({ severity, code, message });
  const { marking, time, verification, mapping, i18n, staff } = config;

  if (!marking.statusSet.includes('present') || !marking.statusSet.includes('absent'))
    add('error', 'status_set_core', 'Present and absent must always be in mark.status_set.');
  if (marking.halfDayHalves && !marking.statusSet.includes('half_day'))
    add('error', 'half_day_halves_without_half_day', 'mark.half_day_halves is on but half day is not in the status set.');
  if (time.fencing && (!time.shiftWindows[1] || !time.shiftWindows[2]))
    add('error', 'fencing_without_windows', 'time.fencing is on but a shift has no window.');
  if (verification.face && ctx.enrolledFaceCount === 0)
    add('error', 'face_without_enrolment', 'verify.face is on but no instructor has an enrolled face.');
  if (mapping.model === 'timetable' && ctx.data.timetable.length === 0)
    add('error', 'timetable_without_data', 'mapping.model is timetable but no timetable is loaded.');
  if (marking.frequency === 'period' && ctx.data.timetable.length === 0)
    add('error', 'period_without_data', 'mark.frequency is period but no timetable periods are loaded.');
  if (mapping.model === 'batch' && !ctx.data.staff.some((s) => s.batchIds.length > 0))
    add('error', 'batch_without_assignments', 'mapping.model is batch but no instructor has assigned batches.');
  if (verification.geoMode === 'fencing' && verification.fenceRadiusM <= 0)
    add('error', 'fence_radius', 'verify.fence_radius_m must be a positive number of metres.');
  if (!i18n.languages.includes(i18n.defaultLanguage))
    add('error', 'default_language', 'i18n.default_language must be one of i18n.languages.');
  if (i18n.languages.length < 1 || i18n.languages.length > 3)
    add('error', 'language_count', 'A state ships between one and three languages.');
  if (staff.enabled && !staff.selfMarking && !staff.principalMarking)
    add('error', 'staff_no_path', 'staff.attendance is on but neither capture path is enabled.');

  if (marking.frequency === 'twice' && marking.statusSet.includes('half_day'))
    add('warning', 'twice_with_half_day', 'Twice-daily marking and half day answer the same question (PRD §10.2).');
  if (verification.face && config.offline.enabled)
    add('warning', 'face_with_offline', 'Face matching may need a server call while offline (PRD open question 12).');
  return issues;
}

export const hasErrors = (issues: readonly ValidationIssue[]) => issues.some((i) => i.severity === 'error');
