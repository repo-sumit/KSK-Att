'use client';
import { useLayoutEffect, useState } from 'react';
import styles from './ToolSlot.module.css';

/*
 * A place in the app header for tooling that sits OUTSIDE the product (for
 * example presenter controls in a demo build). The header always renders the
 * slot: an empty `display: contents` span, so with nothing in it the header
 * lays out exactly as it would without it (no box, no flex gap). Tooling finds
 * it with useHeaderToolSlot() and portals into it; screens without the app
 * header have no slot, and the tooling places itself. The product never puts
 * anything here and never depends on it.
 */

let current: HTMLElement | null = null;
const listeners = new Set<() => void>();

function publish(slot: HTMLElement | null) {
  current = slot;
  listeners.forEach((l) => l());
}

/** Last mounted wins (a new screen's header can mount before the old one leaves); unregister only if still current. */
function register(slot: HTMLSpanElement | null) {
  if (!slot) return;
  publish(slot);
  return () => {
    if (current === slot) publish(null);
  };
}

export function HeaderToolSlot() {
  return <span ref={register} data-tool-slot="" className={styles.slot} />;
}

/** The mounted header's tool slot, or null on screens without the app header. */
export function useHeaderToolSlot(): HTMLElement | null {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // A layout effect rather than useSyncExternalStore's passive subscription: the header (a child of
  // the tooling) has registered its slot by now, so the tooling moves in before the first paint.
  useLayoutEffect(() => {
    const sync = () => setSlot(current);
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);
  return slot;
}
