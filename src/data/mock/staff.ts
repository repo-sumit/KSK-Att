/**
 * Demo master data — institute staff. Demo personas are ordinary staff records;
 * which flow they see comes from configuration + their mapping data, never from
 * their names. Each persona carries complete mapping data (trades, batch
 * allow-list, timetable) so any mapping model works with any persona.
 */
import type { StaffMember } from '@/domain/entities';
import { INSTITUTE_PUNE_ID } from './institutes';

type StaffSeed = Omit<StaffMember, 'instituteId' | 'secondaryTradeIds' | 'batchIds' | 'multiTradeAllowed'> &
  Partial<Pick<StaffMember, 'secondaryTradeIds' | 'batchIds' | 'multiTradeAllowed' | 'instituteId'>>;

const staff = (s: StaffSeed): StaffMember => ({
  instituteId: INSTITUTE_PUNE_ID,
  secondaryTradeIds: [],
  batchIds: [],
  multiTradeAllowed: false,
  ...s,
});

export const STAFF: readonly StaffMember[] = [
  // ---- Demo personas ----
  staff({ id: 'st-rajesh', trainerId: 'TR-10432', name: 'Rajesh Patil', role: 'instructor', employmentType: 'regular', designation: 'Craft Instructor', primaryTradeId: 'ele', batchIds: ['ele-s1u1', 'ele-s2u1'] }),
  staff({ id: 'st-sanjay', trainerId: 'TR-10455', name: 'Sanjay More', role: 'instructor', employmentType: 'regular', designation: 'Craft Instructor', primaryTradeId: 'fit', secondaryTradeIds: ['wel'], multiTradeAllowed: true, batchIds: ['fit-s1u1', 'fit-s2u1'] }),
  staff({ id: 'st-sunita', trainerId: 'TR-10518', name: 'Sunita Jadhav', role: 'instructor', employmentType: 'contractual', designation: 'Craft Instructor', primaryTradeId: 'ele', batchIds: ['ele-s1u2', 'ele-s2u2'] }),
  staff({ id: 'st-vikas', trainerId: 'TR-10377', name: 'Vikas Shinde', role: 'instructor', employmentType: 'regular', designation: 'Craft Instructor', primaryTradeId: 'ele', batchIds: ['ele-s1u2'] }),
  staff({ id: 'st-meera', trainerId: 'TR-11024', name: 'Meera Kulkarni', role: 'instructor', employmentType: 'guest', designation: 'Employability Skills Instructor', subjectId: 'es', batchIds: ['ele-s1u1', 'ele-s2u3', 'fit-s1u2', 'copa-s1u1', 'wel-s2u2'] }),
  staff({ id: 'st-yogesh', trainerId: 'TR-10390', name: 'Yogesh Dalvi', role: 'group_instructor', employmentType: 'regular', designation: 'Group Instructor', primaryTradeId: 'ele', batchIds: ['ele-s1u3', 'ele-s2u3'] }),
  staff({ id: 'st-anil', trainerId: 'PR-2741', name: 'Dr. Anil Deshmukh', role: 'principal', employmentType: 'regular', designation: 'Principal' }),

  // ---- Other instructors ----
  staff({ id: 'st-prakash', trainerId: 'TR-10461', name: 'Prakash Ingale', role: 'instructor', employmentType: 'regular', designation: 'Craft Instructor', primaryTradeId: 'fit', batchIds: ['fit-s1u2'] }),
  staff({ id: 'st-suhas', trainerId: 'TR-10466', name: 'Suhas Kamat', role: 'instructor', employmentType: 'contractual', designation: 'Craft Instructor', primaryTradeId: 'fit', batchIds: ['fit-s2u2'] }),
  staff({ id: 'st-pradeep', trainerId: 'TR-10472', name: 'Pradeep Gawde', role: 'instructor', employmentType: 'regular', designation: 'Craft Instructor', primaryTradeId: 'wel', batchIds: ['wel-s1u1'] }),
  staff({ id: 'st-nilesh', trainerId: 'TR-10475', name: 'Nilesh Raut', role: 'instructor', employmentType: 'regular', designation: 'Craft Instructor', primaryTradeId: 'wel', batchIds: ['wel-s2u1'] }),
  staff({ id: 'st-bharat', trainerId: 'TR-10479', name: 'Bharat Sonawane', role: 'instructor', employmentType: 'guest', designation: 'Craft Instructor', primaryTradeId: 'wel', batchIds: ['wel-s2u2'] }),
  staff({ id: 'st-asha', trainerId: 'TR-10483', name: 'Asha Naik', role: 'instructor', employmentType: 'regular', designation: 'Craft Instructor', primaryTradeId: 'copa', batchIds: ['copa-s1u1'] }),
  staff({ id: 'st-swati', trainerId: 'TR-10487', name: 'Swati Mhatre', role: 'instructor', employmentType: 'contractual', designation: 'Craft Instructor', primaryTradeId: 'copa', batchIds: ['copa-s2u1'] }),
  staff({ id: 'st-ganesh', trainerId: 'TR-10491', name: 'Ganesh Kolte', role: 'instructor', employmentType: 'regular', designation: 'Craft Instructor', primaryTradeId: 'md', batchIds: ['md-s1u1'] }),
  staff({ id: 'st-dattatray', trainerId: 'TR-10494', name: 'Dattatray Shelar', role: 'instructor', employmentType: 'regular', designation: 'Craft Instructor', primaryTradeId: 'md', batchIds: ['md-s2u1'] }),
  staff({ id: 'st-sandeep', trainerId: 'TR-10498', name: 'Sandeep Kharat', role: 'instructor', employmentType: 'guest', designation: 'Craft Instructor', primaryTradeId: 'wel', batchIds: ['wel-s1u1'] }),
  staff({ id: 'st-kalpana', trainerId: 'TR-10502', name: 'Kalpana Borse', role: 'instructor', employmentType: 'regular', designation: 'Craft Instructor', primaryTradeId: 'ele', batchIds: ['ele-s2u2'] }),

  // ---- Another institute (exists in the state, not at Pune) ----
  staff({ id: 'st-nsk-ravi', instituteId: 'inst-27613', trainerId: 'TR-20411', name: 'Ravi Ahire', role: 'instructor', employmentType: 'regular', designation: 'Craft Instructor', primaryTradeId: 'nsk-ele', batchIds: ['nsk-ele-s1u1'] }),
  staff({ id: 'st-nsk-principal', instituteId: 'inst-27613', trainerId: 'PR-2801', name: 'Dr. Sunanda Bagul', role: 'principal', employmentType: 'regular', designation: 'Principal' }),
];

/** "Home" instructor who normally marks each batch — used for seeded history and the timetable. */
export const HOME_INSTRUCTOR: Readonly<Record<string, string>> = {
  'ele-s1u1': 'st-rajesh', 'ele-s1u2': 'st-sunita', 'ele-s1u3': 'st-yogesh', 'ele-s2u1': 'st-rajesh', 'ele-s2u2': 'st-kalpana', 'ele-s2u3': 'st-yogesh',
  'fit-s1u1': 'st-sanjay', 'fit-s1u2': 'st-prakash', 'fit-s2u1': 'st-sanjay', 'fit-s2u2': 'st-suhas',
  'wel-s1u1': 'st-pradeep', 'wel-s2u1': 'st-nilesh', 'wel-s2u2': 'st-bharat',
  'copa-s1u1': 'st-asha', 'copa-s2u1': 'st-swati',
  'md-s1u1': 'st-ganesh', 'md-s2u1': 'st-dattatray',
  'nsk-ele-s1u1': 'st-nsk-ravi',
};
