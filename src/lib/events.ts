/**
 * Minimal typed publish/subscribe used by repositories to announce data changes.
 * UI hooks subscribe to topics and re-query; no global state store is needed.
 */
export type DataTopic =
  | 'session'
  | 'config'
  | 'attendance'
  | 'corrections'
  | 'staff'
  | 'face'
  | 'verification'
  | 'offline'
  | 'packs'
  | 'preferences'
  | 'demo';

type Listener = (topic: DataTopic) => void;

export class EventBus {
  private listeners = new Set<{ topics: ReadonlySet<DataTopic>; fn: Listener }>();

  subscribe(topics: readonly DataTopic[], fn: Listener): () => void {
    const entry = { topics: new Set(topics), fn };
    this.listeners.add(entry);
    return () => {
      this.listeners.delete(entry);
    };
  }

  emit(...topics: DataTopic[]): void {
    for (const entry of [...this.listeners]) {
      if (topics.some((t) => entry.topics.has(t))) entry.fn(topics[0]);
    }
  }
}
