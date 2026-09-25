/**
 * Domain entities shared by every state instance (PRD §4). Only the rules
 * layered on top vary by configuration. These types are the contract between
 * repositories (mock today, API later) and the rest of the app.
 */
import type { LocalDate, LocalTime } from '@/lib/time';

export type InstituteId = string;
export type TradeId = string;
export type BatchId = string;
export type StudentId = string;
export type StaffId = string;
export type SubjectId = string;

export type ShiftNo = 1 | 2;
export type AcademicYear = 1 | 2;

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

export interface TimeWindow {
  readonly start: LocalTime;
  readonly end: LocalTime;
}

export interface Institute {
  readonly id: InstituteId;
  /** Code printed on state records; the first login credential. */
  readonly code: string;
  readonly name: string;
  readonly shortName: string;
  readonly district: string;
  readonly locality: string;
  readonly location: GeoPoint;
  /** Markable window per shift where the state lets institutes override timings. */
  readonly shiftWindows?: Partial<Record<ShiftNo, TimeWindow>>;
}

export interface Trade {
  readonly id: TradeId;
  readonly instituteId: InstituteId;
  readonly name: string;
  readonly durationYears: AcademicYear;
}

/** A cross-trade teaching subject, e.g. Employability Skills, marked separately from the trade's own attendance. */
export interface Subject {
  readonly id: SubjectId;
  readonly name: string;
}

/** A teaching group ("unit") within a trade. Always addressed as shift + unit (PRD §4.1, §7.5). */
export interface Batch {
  readonly id: BatchId;
  readonly tradeId: TradeId;
  readonly shift: ShiftNo;
  readonly unit: number;
  readonly year: AcademicYear;
}

export interface Student {
  readonly id: StudentId;
  readonly batchId: BatchId;
  readonly rollNo: number;
  readonly name: string;
  /** Required on the marking screen: how instructors disambiguate common names (PRD §4.3). */
  readonly fatherName: string;
}

export type StaffRole = 'instructor' | 'group_instructor' | 'principal' | 'office_staff';
/** Recorded for reporting only; never changes permissions (PRD §3.1). */
export type EmploymentType = 'regular' | 'contractual' | 'guest';

export interface StaffMember {
  readonly id: StaffId;
  readonly instituteId: InstituteId;
  /** Credential label printed on staff records ("Trainer ID"). */
  readonly trainerId: string;
  readonly name: string;
  readonly role: StaffRole;
  readonly employmentType: EmploymentType;
  /** Human designation shown at login, e.g. "Craft Instructor". */
  readonly designation: string;
  readonly primaryTradeId?: TradeId;
  readonly secondaryTradeIds: readonly TradeId[];
  /** Explicit batch allow-list (batch-mapped instructors, special instructors). */
  readonly batchIds: readonly BatchId[];
  /** Set for instructors who teach a cross-trade subject (e.g. Employability Skills). */
  readonly subjectId?: SubjectId;
  /** Named instructors the state allows to hold several trades (mapping.multi_trade = named). */
  readonly multiTradeAllowed: boolean;
}

export type PeriodKind = 'theory' | 'practical';

/** One timetabled class. Supplied by the ERP; never authored in this product (PRD §2.2). */
export interface TimetableEntry {
  readonly id: string;
  readonly batchId: BatchId;
  readonly instructorId: StaffId;
  /** 0 = Sunday … 6 = Saturday (same convention as lib/time dayOfWeek). */
  readonly weekday: number;
  readonly periodNo: number;
  readonly kind: PeriodKind;
  readonly window: TimeWindow;
  readonly subjectId?: SubjectId;
}

/** Principal's batch-level or individual OJT declaration, consumed from the ERP (PRD §9.6, §15.2). */
export interface OjtDeclaration {
  readonly id: string;
  readonly studentIds: readonly StudentId[];
  readonly from: LocalDate;
  readonly to: LocalDate;
}

export interface MasterData {
  readonly institutes: readonly Institute[];
  readonly trades: readonly Trade[];
  readonly subjects: readonly Subject[];
  readonly batches: readonly Batch[];
  readonly students: readonly Student[];
  readonly staff: readonly StaffMember[];
  readonly timetable: readonly TimetableEntry[];
  readonly ojt: readonly OjtDeclaration[];
}
