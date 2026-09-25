/**
 * Key/value persistence abstraction behind every mock repository.
 * Browser: localStorage (namespaced, JSON). Tests/SSR: in-memory.
 * Swapping to IndexedDB later only means another implementation of this interface.
 */
export interface KeyValueStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  /** Removes every key under this store's namespace. */
  clear(): void;
}

export class StorageWriteError extends Error {
  constructor(readonly key: string, cause: unknown) {
    super(`Could not save "${key}" on this device`, { cause });
    this.name = 'StorageWriteError';
  }
}

export class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();

  get<T>(key: string): T | undefined {
    const raw = this.data.get(key);
    return raw === undefined ? undefined : (JSON.parse(raw) as T);
  }
  set<T>(key: string, value: T): void {
    this.data.set(key, JSON.stringify(value));
  }
  remove(key: string): void {
    this.data.delete(key);
  }
  clear(): void {
    this.data.clear();
  }
}

export class LocalStorageStore implements KeyValueStore {
  constructor(private readonly namespace: string) {}

  private k(key: string): string {
    return `${this.namespace}:${key}`;
  }
  get<T>(key: string): T | undefined {
    try {
      const raw = window.localStorage.getItem(this.k(key));
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch {
      return undefined;
    }
  }
  set<T>(key: string, value: T): void {
    try {
      window.localStorage.setItem(this.k(key), JSON.stringify(value));
    } catch (cause) {
      // Never lose a record silently: callers (and the user) must see that saving failed.
      throw new StorageWriteError(key, cause);
    }
  }
  remove(key: string): void {
    try {
      window.localStorage.removeItem(this.k(key));
    } catch {
      /* ignore */
    }
  }
  clear(): void {
    try {
      const prefix = `${this.namespace}:`;
      const doomed: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key?.startsWith(prefix)) doomed.push(key);
      }
      doomed.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      /* ignore */
    }
  }
}

/** localStorage in the browser, memory elsewhere (SSR, tests). */
/** localStorage when the WebView allows it; memory otherwise (reading localStorage can throw when storage is blocked). */
export function createDefaultStore(namespace: string): KeyValueStore {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return new LocalStorageStore(namespace);
  } catch {
    // Storage disabled by the host: fall through to memory.
  }
  return new MemoryStore();
}
