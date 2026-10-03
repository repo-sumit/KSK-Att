'use client';
import { useEffect, useRef } from 'react';
import type { ActionBus, UiEvent } from '@/services/voice/action-bus';
import { useServices } from './services';

/** Per bus and event type: the newest event a replaying subscriber has handled (live or replayed). */
const handled = new WeakMap<ActionBus, Map<UiEvent['type'], number>>();

/**
 * Run `handler` for each Action Bus event of `type`. The handler is kept in a ref, so re-renders never resubscribe.
 *
 * `replayMissed`: on mount, also run the handler once with the newest event of `type` that no replaying subscriber
 * has handled yet. The bus delivers synchronously to the listeners present at that moment, so an event emitted in
 * the same tick as a navigation (voice pushes Home, then shows a trade) reaches a screen that mounts afterwards only
 * this way (F7). An event a mounted subscriber already handled is never replayed, so a later tap on that screen is
 * not overridden when it mounts again. `replayBound`: a replay never reaches back past the newest event it matches
 * (AttendanceBoard: voice showed Home again, so an older trade choice is stale).
 */
export function useVoiceBusEvent<T extends UiEvent['type']>(
  type: T,
  handler: (e: Extract<UiEvent, { type: T }>) => void,
  options: { readonly replayMissed?: boolean; readonly replayBound?: (e: UiEvent) => boolean } = {},
): void {
  const { voiceBus } = useServices();
  const replay = options.replayMissed ?? false;
  const handlerRef = useRef(handler);
  const boundRef = useRef(options.replayBound);
  useEffect(() => {
    handlerRef.current = handler;
    boundRef.current = options.replayBound;
  });
  useEffect(() => {
    const run = (e: UiEvent) => handlerRef.current(e as Extract<UiEvent, { type: T }>);
    if (!replay) return voiceBus.subscribe((e) => e.type === type && run(e));
    let seen = handled.get(voiceBus);
    if (!seen) handled.set(voiceBus, (seen = new Map()));
    const book = seen;
    const take = (e: UiEvent) => {
      book.set(type, Math.max(book.get(type) ?? 0, e.seq));
      run(e);
    };
    const log = voiceBus.since(book.get(type) ?? 0);
    const bound = boundRef.current ? log.findLastIndex(boundRef.current) : -1;
    const missed = log.slice(bound + 1).filter((e) => e.type === type).at(-1);
    if (missed) take(missed);
    return voiceBus.subscribe((e) => e.type === type && take(e));
  }, [voiceBus, type, replay]);
}
