import { describe, expect, it } from 'vitest';
import { canMarkBatch, resolveAccess } from '@/domain/access';
import { TODAY, configWith, data, staff } from '../../helpers/fixtures';

describe('resolveAccess — mapping models (PRD §13)', () => {
  it('open: any trade and batch at the institute, via a trade picker', () => {
    const scope = resolveAccess(staff('st-rajesh'), configWith({ mapping: { model: 'open' } }), data, TODAY);
    expect(scope.selection).toBe('trade_picker');
    expect(scope.tradeIds).toEqual(['ele', 'fit', 'wel', 'copa', 'md']);
    expect(scope.batchIds.size).toBe(17);
    expect(canMarkBatch(scope, 'nsk-ele-s1u1')).toBe(false);
  });

  it('trade: single mapped trade skips the trade step', () => {
    const scope = resolveAccess(staff('st-rajesh'), configWith({ mapping: { model: 'trade' } }), data, TODAY);
    expect(scope.selection).toBe('batch_list');
    expect(scope.tradeIds).toEqual(['ele']);
    expect(scope.batchIds.size).toBe(6);
  });

  it('trade: named multi-trade instructor gets a trade switcher', () => {
    const scope = resolveAccess(staff('st-sanjay'), configWith({ mapping: { model: 'trade', multiTrade: 'named' } }), data, TODAY);
    expect(scope.selection).toBe('trade_switcher');
    expect(scope.tradeIds).toEqual(['fit', 'wel']);
  });

  it('trade: multi_trade none keeps only the primary trade', () => {
    const scope = resolveAccess(staff('st-sanjay'), configWith({ mapping: { model: 'trade', multiTrade: 'none' } }), data, TODAY);
    expect(scope.tradeIds).toEqual(['fit']);
  });

  it('batch: only the assigned batches', () => {
    const scope = resolveAccess(staff('st-sunita'), configWith({ mapping: { model: 'batch' } }), data, TODAY);
    expect([...scope.batchIds]).toEqual(['ele-s1u2', 'ele-s2u2']);
    expect(canMarkBatch(scope, 'ele-s1u1')).toBe(false);
  });

  it('Employability Skills: several trades but only allow-listed batches, marked as its own subject', () => {
    const scope = resolveAccess(staff('st-meera'), configWith({ mapping: { model: 'batch' } }), data, TODAY);
    expect(scope.subjectId).toBe('es');
    expect(scope.tradeIds).toEqual(['ele', 'fit', 'wel', 'copa']);
    expect(scope.batchIds.size).toBe(5);
    expect(canMarkBatch(scope, 'ele-s1u2')).toBe(false);
  });

  it('timetable + period: today’s periods for this instructor only', () => {
    const scope = resolveAccess(staff('st-vikas'), configWith({ mapping: { model: 'timetable' }, marking: { frequency: 'period' } }), data, TODAY);
    expect(scope.selection).toBe('timetable');
    expect(scope.timetable.map((t) => `${t.batchId}#${t.periodNo}`)).toEqual(['ele-s1u1#1', 'ele-s1u2#2', 'ele-s1u2#3', 'ele-s1u2#4']);
  });

  it('principal: whole institute and the correction right', () => {
    const scope = resolveAccess(staff('st-anil'), configWith(), data, TODAY);
    expect(scope.selection).toBe('institute');
    expect(scope.isInstituteWide).toBe(true);
    expect(scope.canCorrect).toBe(true);
    expect(scope.subjectId).toBeUndefined();
  });

  it('group instructor: normal marking rights plus a trade-wide view', () => {
    const scope = resolveAccess(staff('st-yogesh'), configWith({ mapping: { model: 'trade' } }), data, TODAY);
    expect(scope.tradeWideViewTradeId).toBe('ele');
    expect(scope.canCorrect).toBe(false);
  });
});
