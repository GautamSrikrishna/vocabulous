import "server-only";

/**
 * A tiny in-process LRU. Homework means looking the same word up repeatedly,
 * and every repeat that lands here is one Sarvam call not paid for.
 *
 * Deliberately in-memory only: it dies with the server, which is exactly the
 * right lifetime for something with no correctness role.
 */
export class LruCache<T> {
  private readonly entries = new Map<string, T>();

  constructor(private readonly maxSize = 500) {}

  get(key: string): T | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    // Re-insert so recently used keys sort to the end.
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: T): void {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.maxSize) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }
}
