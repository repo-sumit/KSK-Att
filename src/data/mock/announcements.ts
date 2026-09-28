/**
 * Demo announcements (D-054), built relative to "today" like seeds.ts so the
 * banner tells the same story on any date. Each targeting kind is represented:
 * institute-wide, trade, batch and named instructors. Texts are bilingual, as
 * the server would send them. None of them changes what can be marked.
 */
import type { Announcement } from '@/domain/announcement';
import { addDays, dayOfWeek, instantAt, type LocalDate } from '@/lib/time';
import { INSTITUTE_PUNE_ID } from './institutes';

/** The next working day (Monday–Saturday) at least `days` ahead. */
function workingDayAhead(today: LocalDate, days: number): LocalDate {
  const d = addDays(today, days);
  return dayOfWeek(d) === 0 ? addDays(d, 1) : d;
}

/** Next Monday strictly after today. */
function nextMonday(today: LocalDate): LocalDate {
  const dow = dayOfWeek(today);
  return addDays(today, dow === 0 ? 1 : 8 - dow);
}

/** Starts of the OJT period the batch notice announces (seeds.ts declares the matching ERP OJT). */
export const OJT_NOTICE_BATCH = 'ele-s1u1';
export const ojtNoticeDates = (today: LocalDate) => {
  const from = workingDayAhead(today, 2);
  return { from, to: addDays(from, 5) };
};

export function buildAnnouncements(today: LocalDate): Announcement[] {
  const holiday = workingDayAhead(today, 1);
  const ojt = ojtNoticeDates(today);
  const monday = nextMonday(today);
  const exam = workingDayAhead(today, 9);
  const at = (daysAgo: number, time: string) => instantAt(addDays(today, -daysAgo), time).toISOString();
  const base = { instituteId: INSTITUTE_PUNE_ID } as const;

  return [
    {
      ...base,
      id: 'ann-holiday',
      category: 'holiday',
      priority: 'high',
      source: 'institute',
      audience: { kind: 'institute' },
      title: { en: 'Special holiday: institute closed', mr: 'विशेष सुट्टी: संस्था बंद' },
      body: {
        en: 'There are no classes on this day. Classes resume on the next working day.',
        mr: 'या दिवशी वर्ग नाहीत. पुढच्या कामकाजाच्या दिवशी वर्ग पुन्हा सुरू होतील.',
      },
      publishedAt: at(1, '16:30'),
      showFrom: addDays(today, -1),
      showUntil: holiday,
      eventFrom: holiday,
      eventTo: holiday,
    },
    {
      ...base,
      id: 'ann-ojt-ele-s1u1',
      category: 'ojt',
      priority: 'normal',
      source: 'principal',
      audience: { kind: 'batch', batchIds: [OJT_NOTICE_BATCH] },
      title: { en: 'Batch on OJT', mr: 'बॅच ओजेटीवर' },
      body: {
        en: 'Students of this batch go to partner industries for on-the-job training. During these days they appear as OJT in the attendance list.',
        mr: 'या बॅचचे विद्यार्थी प्रत्यक्ष कामावर प्रशिक्षणासाठी (ओजेटी) भागीदार उद्योगांमध्ये जातील. या दिवसांत ते हजेरी यादीत ओजेटी म्हणून दिसतील.',
      },
      publishedAt: at(0, '08:30'),
      showFrom: addDays(today, -2),
      showUntil: ojt.to,
      eventFrom: ojt.from,
      eventTo: ojt.to,
    },
    {
      ...base,
      id: 'ann-shift-ele',
      category: 'important',
      priority: 'normal',
      source: 'principal',
      audience: { kind: 'trade', tradeIds: ['ele'] },
      title: { en: 'Shift 2 timing change', mr: 'शिफ्ट 2 च्या वेळेत बदल' },
      body: {
        en: 'From this date, Electrician Shift 2 classes start 30 minutes later. The principal will share the new timetable.',
        mr: 'या तारखेपासून इलेक्ट्रिशियन शिफ्ट 2 चे वर्ग 30 मिनिटे उशिरा सुरू होतील. प्राचार्य नवीन वेळापत्रक देतील.',
      },
      publishedAt: at(2, '12:10'),
      showFrom: addDays(today, -2),
      showUntil: monday,
      eventFrom: monday,
      eventTo: monday,
    },
    {
      ...base,
      id: 'ann-maintenance-wel',
      category: 'important',
      priority: 'normal',
      source: 'institute',
      audience: { kind: 'trade', tradeIds: ['wel'] },
      title: { en: 'Welding workshop closed for maintenance', mr: 'वेल्डिंग कार्यशाळा देखभालीसाठी बंद' },
      body: {
        en: 'The welding workshop is closed for electrical work. Hold practical periods in the classroom. Attendance is marked as usual.',
        mr: 'विद्युत कामासाठी वेल्डिंग कार्यशाळा बंद आहे. प्रात्यक्षिकाचे तास वर्गात घ्या. हजेरी नेहमीप्रमाणे नोंदवा.',
      },
      publishedAt: at(1, '10:00'),
      showFrom: addDays(today, -1),
      showUntil: today,
      eventFrom: today,
      eventTo: today,
    },
    {
      ...base,
      id: 'ann-exam',
      category: 'info',
      priority: 'normal',
      source: 'state',
      audience: { kind: 'institute' },
      title: { en: 'Practical exam for second-year trainees', mr: 'द्वितीय वर्षाच्या प्रशिक्षणार्थींची प्रात्यक्षिक परीक्षा' },
      body: {
        en: 'Practical exams for second-year trainees run on these dates. Keep attendance up to date: students below the attendance limit may not be allowed to sit.',
        mr: 'द्वितीय वर्षाच्या प्रशिक्षणार्थींच्या प्रात्यक्षिक परीक्षा या तारखांना होतील. हजेरी अद्ययावत ठेवा: हजेरी मर्यादेपेक्षा कमी असलेल्या विद्यार्थ्यांना परीक्षेला बसू दिले जाणार नाही.',
      },
      publishedAt: at(3, '11:00'),
      showFrom: addDays(today, -3),
      showUntil: addDays(exam, 3),
      eventFrom: exam,
      eventTo: addDays(exam, 3),
    },
    {
      ...base,
      id: 'ann-meeting',
      category: 'info',
      priority: 'normal',
      source: 'principal',
      audience: { kind: 'staff', staffIds: ['st-rajesh', 'st-sunita', 'st-vikas', 'st-meera', 'st-yogesh'] },
      title: { en: 'Instructor meeting after Shift 1', mr: 'शिफ्ट 1 नंतर निदेशकांची बैठक' },
      body: {
        en: 'A short meeting in the principal’s office after Shift 1 today, about the practical exam schedule.',
        mr: 'आज शिफ्ट 1 नंतर प्राचार्यांच्या कार्यालयात प्रात्यक्षिक परीक्षेच्या वेळापत्रकाबद्दल छोटी बैठक.',
      },
      publishedAt: at(0, '07:30'),
      showFrom: today,
      showUntil: today,
      eventFrom: today,
      eventTo: today,
    },
  ];
}
