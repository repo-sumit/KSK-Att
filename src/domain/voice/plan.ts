/**
 * Flow plan compiler (voice design §5.2): turns the resolved configuration, the journey and the access
 * scope into the facts the voice flow needs. Later layers declare tools and prompt lines only from this
 * plan, so a feature that is switched off (no trade step, no verification, no Leave) is absent here.
 * Pure TypeScript: no I/O, no clock, no framework.
 */
import type { Journey } from '@/config/journey';
import type { AppConfiguration, Language } from '@/config/types';
import type { AccessScope } from '@/domain/access';
import type { StatusCode } from '@/domain/status';

export interface FlowPlan {
  readonly selection: 'trade_picker' | 'trade_switcher' | 'batch_list' | 'timetable';
  readonly tradeStep: boolean;
  readonly slotWords: 'once' | 'halves' | 'signin_signout' | 'period';
  readonly verification: { readonly location: 'none' | 'background' | 'fence'; readonly face: boolean; readonly required: boolean };
  readonly defaultStatus: 'present' | 'absent' | 'blank';
  readonly startStyle: 'roll_call' | 'exceptions';
  readonly rollCallSwitch: boolean;
  readonly statuses: readonly StatusCode[];
  readonly ojtVisible: boolean;
  readonly details: { readonly half: boolean; readonly leaveType: boolean; readonly leaveDays: boolean };
  readonly navTargets: readonly ('home' | 'reports')[];
  readonly languages: readonly Language[];
  readonly openingLanguage: Language;
  readonly timeFencing: boolean;
}

export interface PlanInput {
  readonly config: AppConfiguration;
  readonly journey: Journey;
  readonly access: AccessScope;
}

function slotWords(marking: Journey['marking']): FlowPlan['slotWords'] {
  if (marking.frequency === 'twice') return marking.twiceShape;
  return marking.frequency;
}

/** Null when voice does not exist for this session (journey.voice.enabled false, or the institute view). */
export function compileFlowPlan(input: PlanInput, screenLanguage: Language): FlowPlan | null {
  const { journey, access } = input;
  if (!journey.voice.enabled) return null;
  const selection = access.selection;
  if (selection === 'institute') return null;

  const { marking, verification, voice } = journey;
  const statuses = marking.selectable;
  const defaultStatus = marking.defaultStatus;

  return {
    selection,
    tradeStep: selection === 'trade_picker' || selection === 'trade_switcher',
    slotWords: slotWords(marking),
    verification: { location: verification.location, face: verification.face, required: verification.required },
    defaultStatus,
    // Exceptions mean "everyone present unless said": only over a Present default. Any other default is a roll call.
    startStyle: defaultStatus !== 'present' ? 'roll_call' : voice.markingStyle === 'roll_call' ? 'roll_call' : 'exceptions',
    rollCallSwitch: defaultStatus !== 'blank',
    statuses,
    ojtVisible: marking.ojtVisible,
    details: { half: marking.halfDayHalves, leaveType: statuses.includes('leave'), leaveDays: marking.leaveDateRange },
    navTargets: journey.navTabs.filter((tab): tab is 'home' | 'reports' => tab === 'home' || tab === 'reports'),
    languages: voice.languages,
    openingLanguage: voice.languages.includes(screenLanguage) ? screenLanguage : voice.defaultLanguage,
    timeFencing: journey.timeFencing,
  };
}
