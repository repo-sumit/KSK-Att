import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A fresh copy of the module: one page load. */
async function load() {
  vi.resetModules();
  return import('@/services/voice/debug');
}

describe('voiceDebug', () => {
  it('is off without a location (server, tests) and without the flag', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    expect((await load()).voiceDebugEnabled()).toBe(false);
    vi.stubGlobal('location', { search: '' });
    const { voiceDebug, voiceDebugEnabled } = await load();
    expect(voiceDebugEnabled()).toBe(false);
    voiceDebug('x');
    expect(info).not.toHaveBeenCalled();
  });

  it('is on only for voiceDebug=1 as a whole query parameter (not a longer value or another name)', async () => {
    for (const [search, on] of [['?voiceDebug=1', true], ['?a=b&voiceDebug=1', true], ['?voiceDebug=10', false], ['?voiceDebug=0', false], ['?xvoiceDebug=1', false]] as const) {
      vi.stubGlobal('location', { search });
      expect((await load()).voiceDebugEnabled(), search).toBe(on);
    }
  });

  it('writes one "[voice] " line with console.info when on', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.stubGlobal('location', { search: '?voiceDebug=1' });
    (await load()).voiceDebug('session started');
    expect(info.mock.calls).toEqual([['[voice] session started']]);
  });

  it('keeps working after a navigation drops the parameter, for the rest of the page load (final fix m10)', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const page = { search: '?voiceDebug=1' };
    vi.stubGlobal('location', page);
    const { voiceDebug } = await load();
    page.search = ''; // the first voice step navigated (router.push) before the first line
    voiceDebug('tool select_trade ok');
    page.search = '?trade=ele';
    voiceDebug('tool select_batch ok');
    expect(info.mock.calls).toEqual([['[voice] tool select_trade ok'], ['[voice] tool select_batch ok']]);
  });

  it('turns on when the flag appears later in the page load (a link that adds it)', async () => {
    const page = { search: '' };
    vi.stubGlobal('location', page);
    const { voiceDebugEnabled } = await load();
    expect(voiceDebugEnabled()).toBe(false);
    page.search = '?voiceDebug=1';
    expect(voiceDebugEnabled()).toBe(true);
    page.search = '';
    expect(voiceDebugEnabled()).toBe(true);
  });
});
