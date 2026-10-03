import { describe, expect, it } from 'vitest';
import { deriveJourney } from '@/config/journey';
import type { ConfigLayer } from '@/config/types';
import { resolveAccess } from '@/domain/access';
import { compileFlowPlan } from '@/domain/voice/plan';
import { configWith, data, staff, TODAY } from '../../helpers/fixtures';

const ON: ConfigLayer = { voice: { enabled: true } };
function voiceOffPlan() {
  const config = configWith();
  const user = staff('st-rajesh');
  const access = resolveAccess(user, config, data, TODAY);
  return compileFlowPlan({ config, journey: deriveJourney(config, user, access, true), access }, 'en');
}
function plan(staffId: string, layer: ConfigLayer = {}, screen: 'en' | 'mr' = 'en') {
  const config = configWith({ ...ON, ...layer, voice: { enabled: true, ...layer.voice } });
  const user = staff(staffId);
  const access = resolveAccess(user, config, data, TODAY);
  return compileFlowPlan({ config, journey: deriveJourney(config, user, access, true), access }, screen);
}

describe('compileFlowPlan', () => {
  it('is null when voice is off or for the principal', () => {
    expect(voiceOffPlan()).toBeNull();
    expect(plan('st-anil')).toBeNull();
  });
  it('open mapping, Maharashtra: trade step, fence + face, exceptions', () => {
    expect(plan('st-rajesh', { mapping: { model: 'open' } })).toMatchObject({ selection: 'trade_picker', tradeStep: true, verification: { location: 'fence', face: true, required: true }, startStyle: 'exceptions', rollCallSwitch: true, statuses: ['present', 'absent'], languages: ['en', 'mr'] });
  });
  it('trade mapped with several trades: switcher; batch mapped: no trade step', () => {
    expect(plan('st-sanjay', { mapping: { model: 'trade', multiTrade: 'named' } })).toMatchObject({ selection: 'trade_switcher', tradeStep: true });
    expect(plan('st-sunita', { mapping: { model: 'batch' } })).toMatchObject({ selection: 'batch_list', tradeStep: false });
  });
  it('timetable + period marking + time fence', () => {
    expect(plan('st-vikas', { mapping: { model: 'timetable' }, marking: { frequency: 'period' }, time: { fencing: true } })).toMatchObject({ selection: 'timetable', slotWords: 'period', timeFencing: true });
  });
  it('verification off / tagging / face only', () => {
    expect(plan('st-rajesh', { verification: { geoMode: 'off', face: false } })!.verification).toEqual({ location: 'none', face: false, required: false });
    expect(plan('st-rajesh', { verification: { geoMode: 'tagging', face: false } })!.verification).toEqual({ location: 'background', face: false, required: true });
    expect(plan('st-rajesh', { verification: { geoMode: 'off', face: true } })!.verification).toEqual({ location: 'none', face: true, required: true });
  });
  it('blank default: roll call, no style switch; half day and leave details', () => {
    expect(plan('st-rajesh', { marking: { defaultStatus: 'blank', statusSet: ['present', 'absent', 'half_day', 'leave'], halfDayHalves: true } })).toMatchObject({ startStyle: 'roll_call', rollCallSwitch: false, statuses: ['present', 'absent', 'half_day', 'leave'], details: { half: true, leaveType: true, leaveDays: true } });
  });
  it('opens in the screen language when it is a voice language, else the default', () => {
    expect(plan('st-rajesh', {}, 'mr')!.openingLanguage).toBe('mr');
    expect(plan('st-rajesh', { voice: { enabled: true, languages: ['en'] } }, 'mr')!.openingLanguage).toBe('en');
  });
  it('slot words follow the marking frequency: once, and twice as halves or sign-in/sign-out', () => {
    expect(plan('st-rajesh', { marking: { frequency: 'once' } })!.slotWords).toBe('once');
    expect(plan('st-rajesh', { marking: { frequency: 'twice', twiceShape: 'halves' } })!.slotWords).toBe('halves');
    expect(plan('st-rajesh', { marking: { frequency: 'twice', twiceShape: 'signin_signout' } })!.slotWords).toBe('signin_signout');
  });
  it('a voice marking style overrides what the default status would pick', () => {
    expect(plan('st-rajesh', { marking: { defaultStatus: 'present' }, voice: { enabled: true, markingStyle: 'roll_call' } })!.startStyle).toBe('roll_call');
    expect(plan('st-rajesh', { marking: { defaultStatus: 'blank' }, voice: { enabled: true, markingStyle: 'exceptions' } })).toMatchObject({ startStyle: 'roll_call', rollCallSwitch: false });
    expect(plan('st-rajesh', { marking: { defaultStatus: 'absent' }, voice: { enabled: true, markingStyle: 'exceptions' } })!.startStyle).toBe('roll_call');
    expect(plan('st-rajesh', { marking: { defaultStatus: 'present' }, voice: { enabled: true, markingStyle: 'exceptions' } })!.startStyle).toBe('exceptions');
    expect(plan('st-rajesh', { marking: { defaultStatus: 'present' }, voice: { enabled: true, markingStyle: 'auto' } })!.startStyle).toBe('exceptions');
  });
  it('an absent default starts as a roll call and still offers the style switch', () => {
    expect(plan('st-rajesh', { marking: { defaultStatus: 'absent' } })).toMatchObject({ defaultStatus: 'absent', startStyle: 'roll_call', rollCallSwitch: true });
  });
  it('ojtVisible follows the configured status set', () => {
    expect(plan('st-rajesh', { marking: { statusSet: ['present', 'absent'] } })!.ojtVisible).toBe(false);
    expect(plan('st-rajesh', { marking: { statusSet: ['present', 'absent', 'ojt'] } })!.ojtVisible).toBe(true);
  });
  it('navTargets are the voice-reachable tabs of an instructor: home and reports', () => {
    expect(plan('st-rajesh')!.navTargets).toEqual(['home', 'reports']);
  });
});
