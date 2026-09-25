'use client';
import { useSyncExternalStore } from 'react';
import type { DemoAdapters } from '../adapters';
import type { DemoState } from '../state';

/** DEMO ONLY. Live DemoState for the panel. */
export function useDemoState(demo: DemoAdapters): DemoState {
  return useSyncExternalStore(
    (cb) => demo.repo.subscribe(cb),
    () => demo.repo.get(),
    () => demo.repo.get(),
  );
}
