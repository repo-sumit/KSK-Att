/**
 * Shared, translated labels for sessions, marks and windows. Components call
 * these instead of concatenating strings, so Marathi word order stays correct.
 */
import type { Correction, CorrectionReasonCode, MarkingSlot } from '@/domain/attendance';
import type { Batch, StaffMember, Trade } from '@/domain/entities';
import type { Mark } from '@/domain/status';
import type { I18n } from '@/i18n';
import type { SessionCard } from '@/services/attendance';
import type { StatusLike } from '@/components/ui/status-style';
import { minutesOfDay, parseTime, toLocalDate } from '@/lib/time';

type T = I18n['t'];
type F = I18n['format'];

export const batchTitle = (t: T, batch: Batch) => t('session.batch', { shift: String(batch.shift), unit: String(batch.unit) });

export const batchWithTrade = (t: T, trade: Trade, batch: Batch) =>
  t('session.batchWithTrade', { trade: trade.name, shift: String(batch.shift), unit: String(batch.unit) });

/** Label for the slot when a batch has more than one mark per day. */
export function slotLabel(t: T, slot: MarkingSlot, twiceShape: 'halves' | 'signin_signout'): string | null {
  switch (slot.kind) {
    case 'daily':
      return null;
    case 'half':
      if (twiceShape === 'signin_signout') return slot.part === 1 ? t('session.signIn') : t('session.signOut');
      return slot.part === 1 ? t('session.halfMorning') : t('session.halfAfternoon');
    case 'period':
      return t('session.period', { n: slot.periodNo });
  }
}

/** "Period 3 · Theory" for periods, "Morning" for halves, subject name for subject sessions. */
export function sessionMeta(t: T, card: SessionCard, twiceShape: 'halves' | 'signin_signout', subjectName?: string): string | null {
  const slot = slotLabel(t, card.scheduled.slot, twiceShape);
  const entry = card.scheduled.timetableEntry;
  const parts: string[] = [];
  if (subjectName) parts.push(subjectName);
  if (slot && entry) parts.push(t('session.periodMeta', { period: slot, kind: t(entry.kind === 'theory' ? 'session.theory' : 'session.practical') }));
  else if (slot) parts.push(slot);
  return parts.length ? parts.join(' · ') : null;
}

export function windowRange(f: F, card: SessionCard): string | null {
  const w = card.scheduled.window;
  if (!w) return null;
  return f.clockRange(card.address.date, w.start, w.end);
}

export function statusOf(mark: Mark | undefined): StatusLike {
  return mark?.status ?? 'not_marked';
}

/** "Present", "Half day · First half", "Leave · Sick". */
export function markLabel(t: T, mark: Mark | undefined): string {
  if (!mark || mark.status === null) return t('status.not_marked');
  const base = t(`status.${mark.status}`);
  if (mark.status === 'half_day' && mark.half) return t('status.withHalf', { status: base, half: t(mark.half === 1 ? 'status.firstHalf' : 'status.secondHalf') });
  if (mark.status === 'leave' && mark.leaveType) return t('status.withDetail', { status: base, detail: t(`status.${mark.leaveType}`) });
  return base;
}

export function firstName(member: Pick<StaffMember, 'name'>): string {
  const parts = member.name.replace(/^(Dr|Mr|Mrs|Ms|Shri|Smt)\.?\s+/i, '').split(/\s+/);
  return parts[0] ?? member.name;
}

export function greetingKey(now: Date): 'greeting.morning' | 'greeting.afternoon' | 'greeting.evening' {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(now));
  return hour < 12 ? 'greeting.morning' : hour < 17 ? 'greeting.afternoon' : 'greeting.evening';
}

export const todayOf = (now: Date) => toLocalDate(now);

const REASON_KEYS = { late: 'correction.reasonLate', mistake: 'correction.reasonMistake', duty: 'correction.reasonDuty' } as const;

export const reasonKey = (code: CorrectionReasonCode) => REASON_KEYS[code];

/** A correction's reason in the viewer's language: quick reasons by code, free text as typed. */
export function correctionReason(t: T, c: Pick<Correction, 'reason' | 'reasonCode'>): string {
  return c.reasonCode ? t(REASON_KEYS[c.reasonCode]) : c.reason;
}

/** Window end ("14:00") when a fenced session closes within `withinMin` minutes, so screens can warn before marks are lost. */
export function closingSoon(card: SessionCard, now: Date, withinMin = 10): string | null {
  const end = card.scheduled.window?.end;
  if (!end || card.status !== 'open') return null;
  const left = parseTime(end) - minutesOfDay(now);
  return left > 0 && left <= withinMin ? end : null;
}

const DESIGNATIONS: Readonly<Record<string, 'designation.craftInstructor' | 'designation.groupInstructor' | 'designation.principal' | 'designation.esInstructor'>> = {
  'Craft Instructor': 'designation.craftInstructor',
  'Group Instructor': 'designation.groupInstructor',
  Principal: 'designation.principal',
  'Employability Skills Instructor': 'designation.esInstructor',
};

/** A known ERP designation in the user's language, or null (callers show the raw value as Latin master data). */
export function designationLabel(t: T, raw: string): string | null {
  const key = DESIGNATIONS[raw];
  return key ? t(key) : null;
}
