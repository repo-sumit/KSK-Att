/**
 * Action Bus (D-085): typed, sequenced UI events from the voice executor to the screens.
 * Screens subscribe through `useVoiceBusEvent`; they never import voice code.
 */
import { voiceDebug } from './debug';

export type UiEvent =
  /** `replace` mirrors the tap flow's history: forward steps push; gateway and result transitions replace. */
  | { readonly seq: number; readonly type: 'navigate'; readonly href: string; readonly replace: boolean }
  /** Trade switcher: the chosen trade lives in AttendanceBoard's local state, not the URL. */
  | { readonly seq: number; readonly type: 'show_trade'; readonly tradeId: string }
  | { readonly seq: number; readonly type: 'focus_student'; readonly sessionKey: string; readonly studentId: string }
  | { readonly seq: number; readonly type: 'verify_retry'; readonly sessionKey: string }
  | { readonly seq: number; readonly type: 'end_voice' };

export type UiEventInput = { [K in UiEvent['type']]: Omit<Extract<UiEvent, { type: K }>, 'seq'> }[UiEvent['type']];

const KEEP = 50;

export class ActionBus {
  private seq = 0;
  private log: UiEvent[] = [];
  private listeners = new Set<(e: UiEvent) => void>();
  /** Events waiting for their turn: one emitted from inside a listener is delivered after the current event is done. */
  private queue: UiEvent[] = [];
  private delivering = false;

  emit(event: UiEventInput): UiEvent {
    const stamped = { ...event, seq: ++this.seq } as UiEvent;
    this.log.push(stamped);
    if (this.log.length > KEEP) this.log.splice(0, this.log.length - KEEP);
    this.queue.push(stamped);
    // FIFO, no nesting: an emit from inside a listener only queues; the loop below delivers it afterwards.
    if (this.delivering) return stamped;
    this.delivering = true;
    try {
      for (let next = this.queue.shift(); next; next = this.queue.shift()) this.deliver(next);
    } finally {
      this.delivering = false;
    }
    return stamped;
  }

  private deliver(event: UiEvent): void {
    for (const fn of [...this.listeners]) {
      // A listener unsubscribed by an earlier listener of this same event gets nothing more.
      if (!this.listeners.has(fn)) continue;
      // A throwing subscriber must not starve later listeners or break the voice executor.
      try {
        fn(event);
      } catch {
        voiceDebug(`bus listener threw on ${event.type} #${event.seq}`);
      }
    }
  }

  subscribe(listener: (e: UiEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Events after `seq` (exclusive), oldest first. Only the last 50 are kept. */
  since(seq: number): readonly UiEvent[] {
    return this.log.filter((e) => e.seq > seq);
  }

  get lastSeq(): number {
    return this.seq;
  }
}
