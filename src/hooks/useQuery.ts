'use client';
import { useEffect, useEffectEvent, useState } from 'react';
import type { DataTopic } from '@/lib/events';
import { useContainer } from './services';

export interface QueryState<T> {
  readonly data: T | undefined;
  readonly loading: boolean;
  readonly error: unknown;
  readonly refresh: () => void;
}

interface Settled<T> {
  readonly data?: T;
  readonly error?: unknown;
  readonly key?: string;
  readonly version?: number;
}

/** Session and demo changes always refresh every query (a new session may change what is visible). */
const ALWAYS: readonly DataTopic[] = ['session', 'config', 'demo'];

/**
 * Tiny async data hook. `key` identifies what is being loaded (primitive ids);
 * the query re-runs when the key changes or a repository announces a change on
 * one of `topics`. Keeps the last data while refreshing so lists never flash empty.
 */
export function useQuery<T>(key: string, fetcher: () => Promise<T>, topics: readonly DataTopic[]): QueryState<T> {
  const { bus } = useContainer();
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>({});
  const run = useEffectEvent(fetcher);

  useEffect(() => {
    let alive = true;
    run().then(
      (data) => alive && setSettled({ data, key, version }),
      (error: unknown) => alive && setSettled((s) => ({ ...s, error, key, version })),
    );
    return () => {
      alive = false;
    };
  }, [key, version]);

  const topicKey = [...ALWAYS, ...topics].join('|');
  useEffect(() => bus.subscribe(topicKey.split('|') as DataTopic[], () => setVersion((v) => v + 1)), [bus, topicKey]);

  return {
    data: settled.data,
    loading: settled.key !== key || settled.version !== version,
    error: settled.error,
    refresh: () => setVersion((v) => v + 1),
  };
}
