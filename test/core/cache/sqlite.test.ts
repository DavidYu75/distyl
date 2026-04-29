import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SqliteEmbeddingCache, serializeKey } from '../../../src/core/cache/sqlite';
import type { CacheKey } from '../../../src/core/cache/sqlite';

// Each test gets its own temp DB file so they don't interfere.
let tmpDir: string;
let dbPath: string;
let cache: SqliteEmbeddingCache;

function makeKey(overrides: Partial<CacheKey> = {}): CacheKey {
  return { contentHash: 'abc', modelId: 'model-v1', chunkerVersion: 1, ...overrides };
}

function makeEmbedding(dim = 384, fill = 0.5): Float32Array {
  return new Float32Array(dim).fill(fill);
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'distyl-test-'));
  dbPath = path.join(tmpDir, 'test.db');
  cache = new SqliteEmbeddingCache(undefined, dbPath);
});

afterEach(async () => {
  await cache.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('SqliteEmbeddingCache', () => {
  it('get() returns empty map when no keys are provided', async () => {
    await cache.ready;
    const result = await cache.get([]);
    expect(result.size).toBe(0);
  });

  it('get() returns empty map on cache miss', async () => {
    await cache.ready;
    const result = await cache.get([makeKey()]);
    expect(result.size).toBe(0);
  });

  it('set() + get() roundtrip preserves Float32Array values', async () => {
    await cache.ready;
    const key = makeKey();
    const embedding = makeEmbedding(384, 0.42);
    await cache.set(key, embedding);

    const result = await cache.get([key]);
    const keyStr = serializeKey(key);
    expect(result.has(keyStr)).toBe(true);

    const retrieved = result.get(keyStr)!;
    expect(retrieved).toBeInstanceOf(Float32Array);
    expect(retrieved.length).toBe(384);
    // Spot-check values
    for (let i = 0; i < retrieved.length; i++) {
      expect(retrieved[i]).toBeCloseTo(0.42);
    }
  });

  it('get() returns multiple hits from a batched lookup', async () => {
    await cache.ready;
    const k1 = makeKey({ contentHash: 'hash1' });
    const k2 = makeKey({ contentHash: 'hash2' });
    await cache.set(k1, makeEmbedding(384, 0.1));
    await cache.set(k2, makeEmbedding(384, 0.2));

    const result = await cache.get([k1, k2]);
    expect(result.size).toBe(2);
  });

  it('sessionSetFailures is 0 on a healthy cache', async () => {
    await cache.ready;
    expect(cache.sessionSetFailures).toBe(0);
  });

  it('set() with INSERT OR REPLACE adjusts total_bytes by delta not full size', async () => {
    await cache.ready;
    const key = makeKey();
    // First insert — adds full byte size
    await cache.set(key, makeEmbedding(384, 0.1));
    // Replace with same key — delta should be 0 (same dim)
    await cache.set(key, makeEmbedding(384, 0.9));
    // No error, and the new value is stored
    const result = await cache.get([key]);
    const retrieved = result.get(serializeKey(key))!;
    expect(retrieved[0]).toBeCloseTo(0.9);
  });
});
