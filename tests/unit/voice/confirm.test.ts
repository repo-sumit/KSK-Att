// tests/unit/voice/confirm.test.ts
import { describe, expect, it } from 'vitest';
import { checkConfirm, CONFIRM_TTL_MS, issueConfirm, type ConfirmNow } from '@/domain/voice/confirm';

// Issued in model turn 2 (the trainer's 5th turn began at model turn 1); later: turn 2 ended, the trainer's 6th turn began after it.
const base: ConfirmNow = { action: 'submit_attendance', argsKey: 'k', revision: 3, now: 1000, speechSeq: 5, turnSeq: 2, spokeAtTurn: 1, generation: 1 };
const ticket = issueConfirm(base, [0.1, 0.5, 0.7, 0.9]);
const heardAfter = { speechSeq: 6, turnSeq: 3, spokeAtTurn: 3 };
const later = { ...base, now: 2000, ...heardAfter };

describe('confirmation tokens (D-082)', () => {
  it('issues a 4-character code without look-alike characters', () => {
    expect(ticket.token).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  });
  it('accepts the echoed token after the trainer spoke, with nothing changed', () => {
    expect(checkConfirm(ticket, ticket.token, later)).toEqual({ ok: true });
    expect(checkConfirm(ticket, ticket.token.toLowerCase(), later)).toEqual({ ok: true });
  });
  it('refuses a missing, unknown or other-action token', () => {
    expect(checkConfirm(ticket, undefined, later)).toEqual({ ok: false, reason: 'missing' });
    expect(checkConfirm(ticket, 'ZZZZ', later)).toEqual({ ok: false, reason: 'unknown' });
    expect(checkConfirm(null, ticket.token, later)).toEqual({ ok: false, reason: 'unknown' });
    expect(checkConfirm(ticket, ticket.token, { ...later, action: 'mark_remaining' })).toEqual({ ok: false, reason: 'unknown' });
  });
  it('refuses when the trainer has not spoken since the question', () => {
    expect(checkConfirm(ticket, ticket.token, { ...later, speechSeq: 5 })).toEqual({ ok: false, reason: 'not_heard' });
  });
  it('refuses after any draft change, expiry or a new connection', () => {
    expect(checkConfirm(ticket, ticket.token, { ...later, revision: 4 })).toEqual({ ok: false, reason: 'changed' });
    expect(checkConfirm(ticket, ticket.token, { ...later, argsKey: 'other' })).toEqual({ ok: false, reason: 'changed' });
    expect(checkConfirm(ticket, ticket.token, { ...later, now: 1000 + CONFIRM_TTL_MS + 1 })).toEqual({ ok: false, reason: 'expired' });
    expect(checkConfirm(ticket, ticket.token, { ...later, generation: 2 })).toEqual({ ok: false, reason: 'stale_connection' });
  });
});

describe('fail closed on a number that is not finite (D-082)', () => {
  it('refuses a clock that is NaN or infinite (expired)', () => {
    for (const now of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(checkConfirm(ticket, ticket.token, { ...later, now })).toEqual({ ok: false, reason: 'expired' });
    }
  });
  it('refuses a speech count that is NaN or infinite (not_heard), even though Infinity is greater than any count', () => {
    for (const speechSeq of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(checkConfirm(ticket, ticket.token, { ...later, speechSeq })).toEqual({ ok: false, reason: 'not_heard' });
    }
  });
});

describe('token issue (D-082)', () => {
  it('is bound to the action, arguments, revision, time, speech count and connection it was issued in', () => {
    expect(ticket).toMatchObject({ action: 'submit_attendance', argsKey: 'k', revision: 3, issuedAt: 1000, speechSeq: 5, turnSeq: 2, generation: 1 });
  });
  it('turns each entropy value into one alphabet character and ignores values past the fourth', () => {
    expect(ticket.token).toBe('DSY6');
    expect(issueConfirm(base, [0, 0.999, 0.5, 0.25]).token).toBe('A9SJ');
    expect(issueConfirm(base, [0.1, 0.5, 0.7, 0.9, 0.3, 0.3]).token).toBe('DSY6');
  });
  it('can reach all 32 characters and never uses 0, O, 1 or I', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 32; i += 1) seen.add(issueConfirm(base, [(i + 0.5) / 32, 0, 0, 0]).token[0]);
    expect(seen.size).toBe(32);
    for (const ch of seen) expect(ch).toMatch(/^[A-HJ-NP-Z2-9]$/);
  });
  it('throws RangeError for a used entropy value that is not a finite number in [0, 1)', () => {
    for (const bad of [1, -0.25, 7.9, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      for (let slot = 0; slot < 4; slot += 1) {
        const entropy = [0.1, 0.2, 0.3, 0.4];
        entropy[slot] = bad;
        expect(() => issueConfirm(base, entropy)).toThrow(RangeError);
      }
    }
  });
  it('checks only the four values it uses', () => {
    expect(issueConfirm(base, [0.1, 0.5, 0.7, 0.9, Number.NaN]).token).toBe('DSY6');
  });
  it('throws rather than issue a short code when fewer than four values come in', () => {
    expect(() => issueConfirm(base, [0.1, 0.2, 0.3])).toThrow(RangeError);
    expect(() => issueConfirm(base, [])).toThrow(RangeError);
  });
  it('is valid for exactly two minutes', () => {
    expect(CONFIRM_TTL_MS).toBe(120_000);
    expect(checkConfirm(ticket, ticket.token, { ...later, now: 1000 + CONFIRM_TTL_MS })).toEqual({ ok: true });
  });
});

describe('token check (D-082)', () => {
  it('confirms a bulk mark with the code issued for that status, and not for another status', () => {
    const bulk: ConfirmNow = { ...base, action: 'mark_remaining', argsKey: 'k|PRESENT' };
    const asked = issueConfirm(bulk, [0.2, 0.4, 0.6, 0.8]);
    expect(checkConfirm(asked, asked.token, { ...bulk, now: 2000, ...heardAfter })).toEqual({ ok: true });
    expect(checkConfirm(asked, asked.token, { ...bulk, now: 2000, ...heardAfter, argsKey: 'k|ABSENT' })).toEqual({ ok: false, reason: 'changed' });
  });
  it('reads an absent, null or blank token as no token, even when there is no ticket', () => {
    for (const nothing of [undefined, null, '', '   ', '\n\t']) {
      expect(checkConfirm(ticket, nothing, later), JSON.stringify(nothing) ?? 'undefined').toEqual({ ok: false, reason: 'missing' });
    }
    expect(checkConfirm(null, undefined, later)).toEqual({ ok: false, reason: 'missing' });
  });
  it('reads the echoed code loosely (spaces, case) but never coerces or accepts a near miss', () => {
    expect(checkConfirm(ticket, `  ${ticket.token.toLowerCase()}\n`, later)).toEqual({ ok: true });
    for (const wrong of [ticket.token + 'X', ticket.token.slice(0, 3), ticket.token.split('').join(' '), true, false, 0, 1234, {}, [ticket.token]]) {
      expect(checkConfirm(ticket, wrong, later), JSON.stringify(wrong)).toEqual({ ok: false, reason: 'unknown' });
    }
  });
  it('names the first failing check: missing, unknown, stale_connection, expired, changed, not_heard', () => {
    const expired = 1000 + CONFIRM_TTL_MS + 1;
    const everythingWrong: ConfirmNow = { ...later, action: 'mark_remaining', generation: 2, now: expired, revision: 4, speechSeq: 5 };
    expect(checkConfirm(ticket, undefined, everythingWrong)).toEqual({ ok: false, reason: 'missing' });
    expect(checkConfirm(ticket, ticket.token, everythingWrong)).toEqual({ ok: false, reason: 'unknown' });
    const sameAction = { ...everythingWrong, action: base.action };
    expect(checkConfirm(ticket, ticket.token, sameAction)).toEqual({ ok: false, reason: 'stale_connection' });
    expect(checkConfirm(ticket, ticket.token, { ...sameAction, generation: 1 })).toEqual({ ok: false, reason: 'expired' });
    expect(checkConfirm(ticket, ticket.token, { ...sameAction, generation: 1, now: 2000 })).toEqual({ ok: false, reason: 'changed' });
    expect(checkConfirm(ticket, ticket.token, { ...sameAction, generation: 1, now: 2000, revision: 3 })).toEqual({ ok: false, reason: 'not_heard' });
    expect(checkConfirm(ticket, ticket.token, { ...sameAction, generation: 1, now: 2000, revision: 3, speechSeq: 6 })).toEqual({ ok: true });
  });
  it('does not accept a trainer who spoke before the question, or fewer utterances than were seen then', () => {
    expect(checkConfirm(ticket, ticket.token, { ...later, speechSeq: 4 })).toEqual({ ok: false, reason: 'not_heard' });
    expect(checkConfirm(ticket, ticket.token, { ...later, speechSeq: 7 })).toEqual({ ok: true });
  });
  it('treats a lower draft revision as changed too, not only a higher one', () => {
    expect(checkConfirm(ticket, ticket.token, { ...later, revision: 2 })).toEqual({ ok: false, reason: 'changed' });
  });
  it('fails closed when the clock is not a number or runs backwards', () => {
    // 999 is before issuedAt (1000); the next is an hour before it.
    for (const clock of [Number.NaN, 999, 1000 - 3_600_000, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(checkConfirm(ticket, ticket.token, { ...later, now: clock }), String(clock)).toEqual({ ok: false, reason: 'expired' });
    }
    expect(checkConfirm(ticket, ticket.token, { ...later, now: 1000 })).toEqual({ ok: true }); // the instant it was issued is still fine
  });
  it('fails closed when the speech count is not a number', () => {
    for (const count of [Number.NaN, undefined as unknown as number]) {
      expect(checkConfirm(ticket, ticket.token, { ...later, speechSeq: count }), String(count)).toEqual({ ok: false, reason: 'not_heard' });
    }
  });
});

describe('"spoken since" means a new trainer turn after the asking model turn ended (D-082, final fix F4)', () => {
  it('refuses while the model turn that asked has not ended, however many fragments arrived', () => {
    // late fragments of the words that led to the question: the speech count moved, the turn did not end
    expect(checkConfirm(ticket, ticket.token, { ...later, turnSeq: 2, spokeAtTurn: 2, speechSeq: 9 })).toEqual({ ok: false, reason: 'not_heard' });
    expect(checkConfirm(ticket, ticket.token, { ...later, turnSeq: 2, spokeAtTurn: 1 })).toEqual({ ok: false, reason: 'not_heard' });
  });
  it('refuses when the asking turn ended but the trainer has not spoken since (their last turn began before it ended)', () => {
    expect(checkConfirm(ticket, ticket.token, { ...later, turnSeq: 3, spokeAtTurn: 1, speechSeq: 5 })).toEqual({ ok: false, reason: 'not_heard' });
    // a trainer turn counted after the code but before the asking turn ended: a late transcript of the earlier words
    expect(checkConfirm(ticket, ticket.token, { ...later, turnSeq: 4, spokeAtTurn: 2, speechSeq: 6 })).toEqual({ ok: false, reason: 'not_heard' });
  });
  it('accepts once a trainer turn began after the asking turn ended, also some turns later', () => {
    expect(checkConfirm(ticket, ticket.token, { ...later, turnSeq: 3, spokeAtTurn: 3, speechSeq: 6 })).toEqual({ ok: true });
    expect(checkConfirm(ticket, ticket.token, { ...later, turnSeq: 6, spokeAtTurn: 5, speechSeq: 8 })).toEqual({ ok: true });
  });
  it('fails closed when the turn counts are not finite numbers', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, undefined as unknown as number]) {
      expect(checkConfirm(ticket, ticket.token, { ...later, turnSeq: bad }), `turnSeq ${String(bad)}`).toEqual({ ok: false, reason: 'not_heard' });
      expect(checkConfirm(ticket, ticket.token, { ...later, spokeAtTurn: bad }), `spokeAtTurn ${String(bad)}`).toEqual({ ok: false, reason: 'not_heard' });
    }
  });
});
