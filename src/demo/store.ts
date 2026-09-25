/** DEMO ONLY. Persists DemoState behind the KeyValueStore abstraction. */
import type { KeyValueStore } from '@/lib/kv-store';
import { DEFAULT_DEMO_STATE, decodeDemoState, type DemoState } from './state';

export class DemoStateRepository {
  private state: DemoState;
  private listeners = new Set<() => void>();

  constructor(private readonly store: KeyValueStore) {
    this.state = decodeDemoState(store.get('state'));
  }

  get(): DemoState {
    return this.state;
  }

  update(fn: (current: DemoState) => DemoState): void {
    this.state = fn(this.state);
    this.store.set('state', this.state);
    this.listeners.forEach((l) => l());
  }

  reset(): void {
    this.store.clear();
    this.update(() => DEFAULT_DEMO_STATE);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
