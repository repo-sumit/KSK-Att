'use client';
import { useCallback } from 'react';
import { simulatedDelay } from '@/services/simulation';
import { useContainer } from './services';

/** Pause for UI hold states ("Location verified"), scaled by the simulation speed (0 in tests). */
export function useSimDelay(): (ms: number, signal?: AbortSignal) => Promise<boolean> {
  const { simulation } = useContainer();
  return useCallback(
    async (ms: number, signal?: AbortSignal) => {
      await simulatedDelay(simulation)(ms);
      return !signal?.aborted;
    },
    [simulation],
  );
}
