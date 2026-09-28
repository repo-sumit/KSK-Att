import { describe, expect, it } from 'vitest';
import { compareAnnouncements, isForReader, isShowing, localized, type Announcement, type AnnouncementReader } from '@/domain/announcement';
import { buildAnnouncements } from '@/data/mock/announcements';

const base: Announcement = {
  id: 'a',
  instituteId: 'inst-1',
  category: 'info',
  priority: 'normal',
  source: 'institute',
  audience: { kind: 'institute' },
  title: { en: 'Title', mr: 'शीर्षक' },
  body: { en: 'Body' },
  publishedAt: '2026-09-24T04:00:00.000Z',
  showFrom: '2026-09-24',
  showUntil: '2026-09-26',
};
const reader: AnnouncementReader = { staffId: 'st-1', instituteId: 'inst-1', instituteWide: false, tradeIds: new Set(['ele']), batchIds: new Set(['ele-s1u1']) };

describe('announcement targeting (D-054)', () => {
  it('reaches institute-wide, own-trade, own-batch and named readers only', () => {
    expect(isForReader(base, reader)).toBe(true);
    expect(isForReader({ ...base, audience: { kind: 'trade', tradeIds: ['ele'] } }, reader)).toBe(true);
    expect(isForReader({ ...base, audience: { kind: 'trade', tradeIds: ['wel'] } }, reader)).toBe(false);
    expect(isForReader({ ...base, audience: { kind: 'batch', batchIds: ['ele-s1u1'] } }, reader)).toBe(true);
    expect(isForReader({ ...base, audience: { kind: 'batch', batchIds: ['ele-s2u1'] } }, reader)).toBe(false);
    expect(isForReader({ ...base, audience: { kind: 'staff', staffIds: ['st-1'] } }, reader)).toBe(true);
    expect(isForReader({ ...base, audience: { kind: 'staff', staffIds: ['st-2'] } }, reader)).toBe(false);
  });
  it('never crosses institutes; the principal reads everything at their own', () => {
    expect(isForReader({ ...base, instituteId: 'inst-2' }, { ...reader, instituteWide: true })).toBe(false);
    expect(isForReader({ ...base, audience: { kind: 'staff', staffIds: ['st-2'] } }, { ...reader, instituteWide: true })).toBe(true);
  });
  it('shows only between showFrom and showUntil, inclusive', () => {
    expect(isShowing(base, '2026-09-23')).toBe(false);
    expect(isShowing(base, '2026-09-24')).toBe(true);
    expect(isShowing(base, '2026-09-26')).toBe(true);
    expect(isShowing(base, '2026-09-27')).toBe(false);
  });
  it('orders high priority first, then important > holiday > OJT > info, then newest', () => {
    const list: Announcement[] = [
      { ...base, id: 'info-new', publishedAt: '2026-09-25T04:00:00.000Z' },
      { ...base, id: 'ojt', category: 'ojt' },
      { ...base, id: 'holiday-high', category: 'holiday', priority: 'high' },
      { ...base, id: 'important', category: 'important' },
      { ...base, id: 'info-old' },
    ];
    expect([...list].sort(compareAnnouncements).map((a) => a.id)).toEqual(['holiday-high', 'important', 'ojt', 'info-new', 'info-old']);
  });
  it('falls back to English when a translation is missing', () => {
    expect(localized(base.title, 'mr')).toBe('शीर्षक');
    expect(localized(base.body, 'mr')).toBe('Body');
  });
  it('demo notices cover every audience kind and category, in both languages', () => {
    const all = buildAnnouncements('2026-09-25');
    expect(new Set(all.map((a) => a.audience.kind))).toEqual(new Set(['institute', 'trade', 'batch', 'staff']));
    expect(new Set(all.map((a) => a.category))).toEqual(new Set(['info', 'important', 'holiday', 'ojt']));
    for (const a of all) {
      expect(a.title.mr && a.body.mr).toBeTruthy();
      expect(isShowing(a, '2026-09-25')).toBe(true);
    }
  });
  it('the holiday is never a Sunday', () => {
    // 2026-09-26 is a Saturday: its next working day is Monday the 28th.
    const holiday = buildAnnouncements('2026-09-26').find((a) => a.id === 'ann-holiday');
    expect(holiday?.eventFrom).toBe('2026-09-28');
  });
});
