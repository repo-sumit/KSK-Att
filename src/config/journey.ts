/**
 * Journey derivation: turns the resolved configuration plus the signed-in user
 * into the concrete set of steps, controls and tabs the UI renders. This is the
 * ONLY place screens learn what exists — a disabled capability is simply absent
 * from the journey (PRD §1.2), and no component branches on a person or state.
 */
import type { AccessScope, SelectionMode } from '@/domain/access';
import type { StaffMember } from '@/domain/entities';
import { selectableStatuses } from '@/domain/marking';
import type { StatusCode } from '@/domain/status';
import type { AppConfiguration, DateRangeKind, DefaultStatus, Language, MarkingFrequency, ReportBlock } from './types';

/** Primary destinations. Profile is not one: it opens from the header avatar on every screen (D-046). */
export type NavTab = 'home' | 'attendance' | 'reports';
export type LocationStep = 'none' | 'background' | 'fence';

export interface Journey {
  readonly role: StaffMember['role'];
  /** For services only — screens use the capability fields below, never the role. */
  readonly isPrincipal: boolean;
  /** Which home layout: an instructor's classes, or the institute overview. */
  readonly homeVariant: 'instructor' | 'institute';
  readonly selection: SelectionMode;
  readonly verification: {
    /** none: no geo code path; background: geo-tagging, invisible unless permission fails; fence: visible gate. */
    readonly location: LocationStep;
    readonly face: boolean;
    readonly fencePassPrompt: 'silent' | 'confirm';
    /** Whether a verification screen exists at all before the student list. */
    readonly required: boolean;
    readonly faceRetryLimit: number | null;
  };
  /** Face is on and this user has no enrolled reference: enrolment comes first. */
  readonly faceEnrolmentRequired: boolean;
  readonly marking: {
    readonly frequency: MarkingFrequency;
    readonly twiceShape: 'halves' | 'signin_signout';
    readonly defaultStatus: DefaultStatus;
    /** Statuses the instructor can tap, in order. Always starts with present, absent. */
    readonly selectable: readonly StatusCode[];
    readonly halfDayHalves: boolean;
    readonly leaveDateRange: boolean;
    readonly ojtVisible: boolean;
  };
  readonly timeFencing: boolean;
  readonly staff: {
    /** "My attendance" card on the instructor home. */
    readonly selfCard: boolean;
    readonly selfCanMark: boolean;
    /** Students / Staff switch for the principal. */
    readonly principalStaffView: boolean;
    readonly principalCanMark: boolean;
    readonly statusSet: readonly StatusCode[];
  };
  readonly corrections: boolean;
  readonly principalCanMarkStudents: boolean;
  readonly tradeWideView: boolean;
  readonly reports: {
    readonly enabled: boolean;
    readonly blocks: readonly ReportBlock[];
    readonly dateRanges: readonly DateRangeKind[];
    readonly pdfDownload: boolean;
    readonly eligibilityThresholdPct: number;
  };
  readonly offline: { readonly enabled: boolean; readonly manualRefresh: boolean; readonly multiSelect: boolean; readonly maxBatches: number | null };
  readonly language: { readonly available: readonly Language[]; readonly canSwitch: boolean };
  readonly navTabs: readonly NavTab[];
}

const INSTRUCTOR_BLOCKS: readonly ReportBlock[] = ['my_attendance', 'my_batches', 'student_percentage', 'daily_register'];
const PRINCIPAL_BLOCKS: readonly ReportBlock[] = ['institute_summary', 'trade_batch', 'staff_summary', 'correction_log'];

export function deriveJourney(config: AppConfiguration, user: StaffMember, access: AccessScope, faceEnrolled: boolean): Journey {
  const isPrincipal = user.role === 'principal';
  const geo = config.verification.geoMode;
  const location: LocationStep = geo === 'off' ? 'none' : geo === 'tagging' ? 'background' : 'fence';
  const face = config.verification.face;
  const staff = config.staff;

  const roleBlocks = isPrincipal ? PRINCIPAL_BLOCKS : INSTRUCTOR_BLOCKS;
  const blocks = roleBlocks
    .filter((b) => config.reports.blocks.includes(b))
    // Staff blocks disappear with the capability they report on.
    .filter((b) => staff.enabled || (b !== 'my_attendance' && b !== 'staff_summary'))
    .filter((b) => b !== 'correction_log' || config.identity.principalCanCorrect);

  const reportsEnabled = config.reports.enabled && blocks.length > 0;
  const navTabs: NavTab[] = ['home', 'attendance', ...(reportsEnabled ? (['reports'] as const) : [])];

  return {
    role: user.role,
    isPrincipal,
    homeVariant: access.isInstituteWide ? 'institute' : 'instructor',
    selection: access.selection,
    verification: {
      location,
      face,
      fencePassPrompt: config.verification.fencePassPrompt,
      required: location !== 'none' || face,
      faceRetryLimit: config.verification.faceRetryLimit,
    },
    faceEnrolmentRequired: face && !faceEnrolled,
    marking: {
      frequency: config.marking.frequency,
      twiceShape: config.marking.twiceShape,
      defaultStatus: config.marking.defaultStatus,
      selectable: selectableStatuses(config.marking),
      halfDayHalves: config.marking.halfDayHalves && config.marking.statusSet.includes('half_day'),
      leaveDateRange: config.marking.leaveDateRange && config.marking.statusSet.includes('leave'),
      ojtVisible: config.marking.statusSet.includes('ojt'),
    },
    timeFencing: config.time.fencing,
    staff: {
      selfCard: staff.enabled && !isPrincipal,
      selfCanMark: staff.enabled && staff.selfMarking && !isPrincipal,
      principalStaffView: staff.enabled && isPrincipal,
      principalCanMark: staff.enabled && staff.principalMarking && isPrincipal,
      statusSet: staff.statusSet,
    },
    corrections: access.canCorrect,
    principalCanMarkStudents: isPrincipal && config.identity.principalCanMarkStudents,
    tradeWideView: Boolean(access.tradeWideViewTradeId),
    reports: {
      enabled: reportsEnabled,
      blocks,
      dateRanges: config.reports.dateRanges,
      pdfDownload: config.reports.pdfDownload,
      eligibilityThresholdPct: config.reports.eligibilityThresholdPct,
    },
    offline: {
      enabled: config.offline.enabled && !isPrincipal,
      manualRefresh: config.offline.manualRefresh,
      multiSelect: config.offline.multiSelect,
      maxBatches: config.offline.maxBatches,
    },
    language: { available: config.i18n.languages, canSwitch: config.i18n.userSwitch && config.i18n.languages.length > 1 },
    navTabs,
  };
}
