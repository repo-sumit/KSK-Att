/**
 * AuthService — the two-input login with a confirmation at each step (PRD §6):
 * institute code → confirm institute → trainer ID → confirm instructor → session.
 *
 * MockAuthService resolves against master data. ApiAuthService (repositories/api)
 * will call the backend; the UI depends only on this interface. Institute code +
 * trainer ID is an identification step, not strong authentication — a second
 * factor is an open PRD question (§22 Q1) and slots in as another step later.
 */
import type { Institute, InstituteId, StaffMember } from '@/domain/entities';
import { err, ok, type Result } from '@/lib/result';
import type { Clock } from '@/lib/time';
import type { MasterDataRepository, SessionRepository, StoredSession } from '@/repositories/interfaces';

export interface InstituteMatch {
  readonly id: InstituteId;
  readonly code: string;
  readonly name: string;
  readonly shortName: string;
  readonly district: string;
  readonly locality: string;
}

export interface InstructorMatch {
  readonly id: string;
  readonly name: string;
  readonly role: StaffMember['role'];
  readonly employmentType: StaffMember['employmentType'];
  readonly designation: string;
  readonly primaryTradeId?: string;
  readonly subjectId?: string;
  /** Display names for the confirmation card. */
  readonly tradeName?: string;
  readonly subjectName?: string;
  readonly instituteShortName: string;
}

export interface AuthService {
  lookupInstitute(code: string): Promise<Result<InstituteMatch, 'invalid_format' | 'not_found'>>;
  lookupInstructor(instituteId: InstituteId, trainerId: string): Promise<Result<InstructorMatch, 'invalid_format' | 'not_found'>>;
  startSession(instituteId: InstituteId, staffId: string): Promise<StoredSession>;
  currentSession(): Promise<StoredSession | undefined>;
  signOut(): Promise<void>;
}

const INSTITUTE_CODE = /^\d{4,6}$/;
const TRAINER_ID = /^[A-Z]{2}-\d{3,6}$/;

/** "tr10432", "TR 10432", "TR–10432" → "TR-10432": the hyphen is on the symbols keyboard, so people skip it. */
export function normalizeTrainerId(input: string): string {
  const upper = input.trim().toUpperCase();
  const m = /^([A-Z]{2})[\s\-–—]*(\d{3,6})$/.exec(upper);
  return m ? `${m[1]}-${m[2]}` : upper;
}

const toInstituteMatch = (i: Institute): InstituteMatch => ({ id: i.id, code: i.code, name: i.name, shortName: i.shortName, district: i.district, locality: i.locality });

export class MockAuthService implements AuthService {
  constructor(
    private readonly masterData: MasterDataRepository,
    private readonly sessions: SessionRepository,
    private readonly clock: Clock,
  ) {}

  async lookupInstitute(code: string) {
    const clean = code.trim();
    if (!INSTITUTE_CODE.test(clean)) return err('invalid_format');
    const institute = await this.masterData.findInstituteByCode(clean);
    return institute ? ok(toInstituteMatch(institute)) : err('not_found');
  }

  async lookupInstructor(instituteId: InstituteId, trainerId: string) {
    const clean = normalizeTrainerId(trainerId);
    if (!TRAINER_ID.test(clean)) return err('invalid_format');
    const staff = await this.masterData.findStaffByTrainerId(instituteId, clean);
    if (!staff || staff.role === 'office_staff') return err('not_found');
    const data = await this.masterData.getInstituteData(instituteId);
    return ok({
      tradeName: data.trades.find((t) => t.id === staff.primaryTradeId)?.name,
      subjectName: data.subjects.find((s) => s.id === staff.subjectId)?.name,
      instituteShortName: data.institutes[0]?.shortName ?? '',
      id: staff.id,
      name: staff.name,
      role: staff.role,
      employmentType: staff.employmentType,
      designation: staff.designation,
      primaryTradeId: staff.primaryTradeId,
      subjectId: staff.subjectId,
    });
  }

  async startSession(instituteId: InstituteId, staffId: string) {
    const session = { instituteId, staffId, startedAt: this.clock.now().toISOString() };
    await this.sessions.set(session);
    return session;
  }

  currentSession() {
    return this.sessions.get();
  }

  signOut() {
    return this.sessions.clear();
  }
}
