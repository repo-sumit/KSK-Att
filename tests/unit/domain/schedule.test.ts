import { describe, expect, it } from 'vitest';
import { slotsForBatch, windowState } from '@/domain/schedule';
import { instantAt } from '@/lib/time';
import { TODAY, configWith, data } from '../../helpers/fixtures';

const batch = (id: string) => data.batches.find((b) => b.id === id)!;
const institute = data.institutes[0];
const at = (time: string) => instantAt(TODAY, time);

describe('marking slots and windows (PRD §10–11)', () => {
  it('once daily with fencing uses the shift window', () => {
    const [slot] = slotsForBatch({ batch: batch('ele-s2u1'), institute, date: TODAY, config: configWith(), timetable: data.timetable });
    expect(slot.slot).toEqual({ kind: 'daily' });
    expect(slot.window).toEqual({ start: '14:00', end: '20:00' });
    expect(windowState(slot.window, at('10:15'))).toBe('future');
    expect(windowState(slot.window, at('14:00'))).toBe('open');
    expect(windowState(slot.window, at('20:00'))).toBe('closed');
  });

  it('no time fencing: markable all day', () => {
    const [slot] = slotsForBatch({ batch: batch('ele-s2u1'), institute, date: TODAY, config: configWith({ time: { fencing: false } }), timetable: data.timetable });
    expect(slot.window).toBeNull();
    expect(windowState(slot.window, at('23:30'))).toBe('open');
  });

  it('twice daily splits the shift into two separately locked marks', () => {
    const slots = slotsForBatch({ batch: batch('ele-s1u1'), institute, date: TODAY, config: configWith({ marking: { frequency: 'twice' } }), timetable: data.timetable });
    expect(slots.map((s) => s.slot)).toEqual([{ kind: 'half', part: 1 }, { kind: 'half', part: 2 }]);
    expect(slots.map((s) => windowState(s.window, at('10:15')))).toEqual(['open', 'future']);
  });

  it('period level follows the timetable; trade periods exclude the ES subject period', () => {
    const cfg = configWith({ marking: { frequency: 'period' } });
    const trade = slotsForBatch({ batch: batch('ele-s1u1'), institute, date: TODAY, config: cfg, timetable: data.timetable });
    expect(trade.map((s) => s.slot)).toEqual([{ kind: 'period', periodNo: 1 }, { kind: 'period', periodNo: 2 }, { kind: 'period', periodNo: 4 }]);
    const es = slotsForBatch({ batch: batch('ele-s1u1'), institute, date: TODAY, config: cfg, timetable: data.timetable, subjectId: 'es' });
    expect(es.map((s) => s.slot)).toEqual([{ kind: 'period', periodNo: 3 }]);
  });
});
