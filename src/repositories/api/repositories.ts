/**
 * API-backed repositories — the swap target for repositories/mock. Each method
 * documents its intended endpoint; bodies throw NotImplementedError until the
 * backend exists. Device-local concerns (drafts, offline queue, packs,
 * verification passes, session, preferences) stay on the device in every mode;
 * only these server-owned repositories change.
 */
import type { AttendanceSubmission, Correction, StaffAttendanceRecord } from '@/domain/attendance';
import type { Institute, InstituteId, MasterData, StaffMember } from '@/domain/entities';
import type { Result } from '@/lib/result';
import type { LocalDate } from '@/lib/time';
import type { CorrectionRepository, MasterDataRepository, StaffAttendanceRepository, SubmissionQuery, SyncGateway } from '../interfaces';
import { type ApiClient, NotImplementedError } from './client';

export class ApiMasterDataRepository implements MasterDataRepository {
  constructor(private readonly api: ApiClient) {}
  /** GET /institutes?code={code} */
  findInstituteByCode(code: string): Promise<Institute | undefined> {
    void this.api;
    throw new NotImplementedError(`findInstituteByCode(${code})`);
  }
  /** GET /institutes/{id}/staff?trainerId={id} — scoped to the institute (PRD §6.2). */
  findStaffByTrainerId(instituteId: InstituteId, trainerId: string): Promise<StaffMember | undefined> {
    throw new NotImplementedError(`findStaffByTrainerId(${instituteId}, ${trainerId})`);
  }
  /** GET /institutes/{id}/bundle — trades, batches, rosters, timetable, OJT (cacheable, also the offline pack source). */
  getInstituteData(instituteId: InstituteId): Promise<MasterData> {
    throw new NotImplementedError(`getInstituteData(${instituteId})`);
  }
}

/** Server-side submission store; writes go through the offline queue + SyncGateway. */
export class ApiAttendanceReadModel {
  constructor(private readonly api: ApiClient) {}
  /** GET /attendance?batchIds=&from=&to= */
  listSubmissions(query: SubmissionQuery): Promise<AttendanceSubmission[]> {
    void this.api;
    throw new NotImplementedError(`listSubmissions(${JSON.stringify(query)})`);
  }
}

export class ApiCorrectionRepository implements CorrectionRepository {
  constructor(private readonly api: ApiClient) {}
  /** POST /attendance/{attendanceId}/corrections — server re-validates principal, same day, reason. */
  append(correction: Correction): Promise<void> {
    void this.api;
    throw new NotImplementedError(`append(${correction.correctionId})`);
  }
  /** GET /corrections?attendanceIds= */
  listForAttendance(attendanceIds: readonly string[]): Promise<Correction[]> {
    throw new NotImplementedError(`listForAttendance(${attendanceIds.length})`);
  }
  /** GET /corrections?from=&to= (audit log, read-only for every role) */
  listBetween(from: LocalDate, to: LocalDate): Promise<Correction[]> {
    throw new NotImplementedError(`listBetween(${from}, ${to})`);
  }
}

export class ApiStaffAttendanceRepository implements StaffAttendanceRepository {
  constructor(private readonly api: ApiClient) {}
  get(staffId: string, date: LocalDate): Promise<StaffAttendanceRecord | undefined> {
    void this.api;
    throw new NotImplementedError(`get(${staffId}, ${date})`);
  }
  getById(id: string): Promise<StaffAttendanceRecord | undefined> {
    throw new NotImplementedError(`getById(${id})`);
  }
  listForDate(date: LocalDate): Promise<StaffAttendanceRecord[]> {
    throw new NotImplementedError(`listForDate(${date})`);
  }
  listBetween(staffIds: readonly string[], from: LocalDate, to: LocalDate): Promise<StaffAttendanceRecord[]> {
    throw new NotImplementedError(`listBetween(${staffIds.length}, ${from}, ${to})`);
  }
  create(record: StaffAttendanceRecord): Promise<Result<StaffAttendanceRecord, 'already_marked'>> {
    throw new NotImplementedError(`create(${record.id})`);
  }
  markSynced(id: string): Promise<void> {
    throw new NotImplementedError(`markSynced(${id})`);
  }
}

/** Pushes locally locked records; the server enforces write-once per session key (409 → already submitted). */
export class ApiSyncGateway implements SyncGateway {
  constructor(private readonly api: ApiClient) {}
  /** POST /attendance (idempotent on submission.id) */
  pushSubmission(submission: AttendanceSubmission): Promise<Result<{ serverTimestamp: string }, 'network' | 'rejected'>> {
    void this.api;
    throw new NotImplementedError(`pushSubmission(${submission.id})`);
  }
  /** POST /staff-attendance */
  pushStaffRecord(record: StaffAttendanceRecord): Promise<Result<{ serverTimestamp: string }, 'network' | 'rejected'>> {
    throw new NotImplementedError(`pushStaffRecord(${record.id})`);
  }
}
