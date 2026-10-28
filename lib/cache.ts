import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * A tiny in-process LRU. Homework means looking the same word up repeatedly,
 * and every repeat that lands here is one Sarvam call not paid for.
 */
export class LruCache<T> {
  protected readonly entries = new Map<string, T>();

  constructor(protected readonly maxSize = 500) {}

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

  /** Oldest entry first, which is the order `set` must replay to rebuild the LRU. */
  snapshot(): [string, T][] {
    return [...this.entries];
  }
}

/**
 * Bump when the cached value's shape changes. A file written by an older
 * version is discarded rather than fed to the UI as if it were current.
 */
const FILE_VERSION = 2;

interface CacheFile<T> {
  version: number;
  entries: [string, T][];
}

/**
 * An LRU that survives a restart by writing itself to a JSON file.
 *
 * This app is started fresh whenever it's needed and stopped afterwards, so a
 * purely in-memory cache never gets to warm up — every session would re-pay for
 * the words looked up in the last one. Persisting makes a spelling list revisited
 * across several evenings free after the first pass.
 *
 * Every failure path is deliberately silent. A cache that cannot be read or
 * written is still a working cache; it just costs an API call.
 */
export class PersistentLruCache<T> {
  private readonly memory: LruCache<T>;
  private ready: Promise<void> | null = null;
  /** Serialises writes so two lookups finishing together can't interleave. */
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    maxSize = 500,
  ) {
    this.memory = new LruCache<T>(maxSize);
  }

  private ensureLoaded(): Promise<void> {
    this.ready ??= this.readFromDisk();
    return this.ready;
  }

  private async readFromDisk(): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(this.filePath, "utf8"));
    } catch {
      return; // No file yet, or unreadable/corrupt. Start empty.
    }

    const file = parsed as Partial<CacheFile<T>>;
    if (file?.version !== FILE_VERSION || !Array.isArray(file.entries)) return;

    for (const entry of file.entries) {
      if (Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string") {
        this.memory.set(entry[0], entry[1] as T);
      }
    }
  }

  async get(key: string): Promise<T | undefined> {
    await this.ensureLoaded();
    return this.memory.get(key);
  }

  async set(key: string, value: T): Promise<void> {
    await this.ensureLoaded();
    this.memory.set(key, value);
    // Chained rather than awaited concurrently: the last writer wins, and it
    // always writes a complete snapshot.
    this.writing = this.writing.then(() => this.writeToDisk());
    await this.writing;
  }

  private async writeToDisk(): Promise<void> {
    const file: CacheFile<T> = { version: FILE_VERSION, entries: this.memory.snapshot() };
    // Write-then-rename, so an interrupted write can't leave a half-file behind.
    const temp = `${this.filePath}.${process.pid}.tmp`;
    try {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      await writeFile(temp, JSON.stringify(file), "utf8");
      await rename(temp, this.filePath);
    } catch {
      // Losing the cache costs an API call, not correctness.
    }
  }
}

/** Where the persisted caches live. Gitignored; safe to delete at any time. */
export const CACHE_DIR = path.join(process.cwd(), ".cache");
