import { describe, expect, it } from 'vitest';
import { deriveJourney } from '@/config/journey';
import { resolveConfiguration, restrictLayer } from '@/config/resolve';
import { MAHARASHTRA } from '@/config/states/maharashtra';
import { validateConfiguration } from '@/config/validate';
import { resolveAccess } from '@/domain/access';
import { TODAY, configWith, data, staff } from '../../helpers/fixtures';

describe('configuration resolution (PRD §5.1)', () => {
  it('institute layers may only override keys the state opened', () => {
    const layer = restrictLayer({ verification: { fenceRadiusM: 800, face: false } }, MAHARASHTRA.overridableKeys);
    expect(layer).toEqual({ verification: { fenceRadiusM: 800 } });
  });
  it('applies an allowed institute override and ignores the rest', () => {
    const state = { ...MAHARASHTRA, instituteLayers: { 'inst-27410': { verification: { fenceRadiusM: 800, face: false } } } };
    const cfg = resolveConfiguration({ state, instituteId: 'inst-27410' });
    expect(cfg.verification.fenceRadiusM).toBe(800);
    expect(cfg.verification.face).toBe(true);
  });
  it('always keeps present and absent in the status set', () => {
    expect(configWith({ marking: { statusSet: ['leave'] } }).marking.statusSet).toEqual(expect.arrayContaining(['present', 'absent', 'leave']));
  });
});

describe('validation (PRD §14.6)', () => {
  const ctx = { data, enrolledFaceCount: 10 };
  it('the Maharashtra configuration is valid', () => {
    expect(validateConfiguration(configWith(), ctx).filter((i) => i.severity === 'error')).toEqual([]);
  });
  it('rejects half-day halves without half day', () => {
    const issues = validateConfiguration(configWith({ marking: { halfDayHalves: true } }), ctx);
    expect(issues.map((i) => i.code)).toContain('half_day_halves_without_half_day');
  });
  it('rejects face verification with nobody enrolled', () => {
    expect(validateConfiguration(configWith(), { data, enrolledFaceCount: 0 }).map((i) => i.code)).toContain('face_without_enrolment');
  });
});

describe('journey derivation — disabled means absent (PRD §1.2)', () => {
  const journeyFor = (id: string, overrides = {}, enrolled = true) => {
    const cfg = configWith(overrides);
    return deriveJourney(cfg, staff(id), resolveAccess(staff(id), cfg, data, TODAY), enrolled);
  };
  it('geo off + face off removes the verification screen entirely', () => {
    const j = journeyFor('st-rajesh', { verification: { geoMode: 'off', face: false } });
    expect(j.verification.required).toBe(false);
    expect(j.faceEnrolmentRequired).toBe(false);
  });
  it('geo tagging is a background step', () => expect(journeyFor('st-rajesh', { verification: { geoMode: 'tagging' } }).verification.location).toBe('background'));
  it('face on and not enrolled requires enrolment first', () => expect(journeyFor('st-rajesh', {}, false).faceEnrolmentRequired).toBe(true));
  it('extra statuses appear only when configured', () => {
    expect(journeyFor('st-rajesh').marking.selectable).toEqual(['present', 'absent']);
    expect(journeyFor('st-rajesh', { marking: { statusSet: ['present', 'absent', 'half_day', 'leave', 'ojt'] } }).marking.selectable).toEqual(['present', 'absent', 'half_day', 'leave']);
  });
  it('staff attendance off removes the self card and the staff view', () => {
    const j = journeyFor('st-anil', { staff: { enabled: false } });
    expect(j.staff.principalStaffView).toBe(false);
    expect(j.reports.blocks).not.toContain('staff_summary');
  });
  it('reports off removes the Reports tab', () => expect(journeyFor('st-rajesh', { reports: { enabled: false } }).navTabs).toEqual(['home', 'attendance', 'profile']));
});
