import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Database } from '@vscode/sqlite3';
import type { OutputChannel } from 'vscode';

const DB_DIR = path.join(os.homedir(), '.distyl');
const DB_PATH = path.join(DB_DIR, 'distyl.db');
const EVICTION_BYTES = 50 * 1024 * 1024;  // 50 MB — trigger LRU eviction
const SAFETY_BYTES   = 60 * 1024 * 1024;  // 60 MB — hard skip on next set()

export interface CacheKey {
  contentHash: string;
  modelId: string;
  chunkerVersion: number;
}

// Opaque string used as Map key for cache hits.
export type CacheKeyStr = string;

export function serializeKey(k: CacheKey): CacheKeyStr {
  return `${k.contentHash}|${k.modelId}|${k.chunkerVersion}`;
}

export class SqliteEmbeddingCache {
  private db!: Database;
  private setFailures = 0;
  readonly ready: Promise<void>;

  constructor(
    private readonly outputChannel?: OutputChannel,
    dbPath = DB_PATH,
  ) {
    this.ready = this.init(dbPath);
  }

  // ─── public API ──────────────────────────────────────────────────────────

  /**
   * Batched cache lookup. Returns a map of found keys → Float32Array.
   * Also updates last_used for hits in a fire-and-forget write.
   */
  async get(keys: CacheKey[]): Promise<Map<CacheKeyStr, Float32Array>> {
    await this.ready;
    if (keys.length === 0) return new Map();

    // Use serialized key in WHERE for portability across SQLite versions.
    const serialized = keys.map(serializeKey);
    const placeholders = serialized.map(() => '?').join(',');

    const rows = await dbAll<{
      content_hash: string;
      model_id: string;
      chunker_version: number;
      embedding: Buffer;
    }>(
      this.db,
      `SELECT content_hash, model_id, chunker_version, embedding
         FROM embeddings
        WHERE (content_hash || '|' || model_id || '|' || CAST(chunker_version AS TEXT))
              IN (${placeholders})`,
      serialized,
    );

    const result = new Map<CacheKeyStr, Float32Array>();
    const now = Date.now();
    const hitKeys: string[] = [];

    for (const row of rows) {
      const k = serializeKey({
        contentHash: row.content_hash,
        modelId: row.model_id,
        chunkerVersion: row.chunker_version,
      });
      hitKeys.push(k);
      // Buffer.buffer may have a non-zero byteOffset — slice to get a clean ArrayBuffer.
      const ab = row.embedding.buffer.slice(
        row.embedding.byteOffset,
        row.embedding.byteOffset + row.embedding.byteLength,
      );
      result.set(k, new Float32Array(ab));
    }

    // Batch last_used update — fire-and-forget, does not block get() return.
    if (hitKeys.length > 0) {
      const hitPlaceholders = hitKeys.map(() => '?').join(',');
      dbRun(
        this.db,
        `UPDATE embeddings
            SET last_used = ?
          WHERE (content_hash || '|' || model_id || '|' || CAST(chunker_version AS TEXT))
                IN (${hitPlaceholders})`,
        [now, ...hitKeys],
      ).catch((err) =>
        this.outputChannel?.appendLine(`[distyl cache] last_used update failed: ${err}`),
      );
    }

    return result;
  }

  /**
   * Stores one embedding. Tracks total_bytes via the meta table.
   * Safety valve: skips insert if total >= 60 MB.
   * Failure handling: logs + counts; throws so callers can detect 3+ failures.
   * Eviction is fire-and-forget (does not block return).
   */
  async set(key: CacheKey, embedding: Float32Array): Promise<void> {
    await this.ready;
    try {
      const meta = await dbGet<{ value: number }>(
        this.db,
        `SELECT value FROM meta WHERE key = 'total_bytes'`,
      );
      if ((meta?.value ?? 0) >= SAFETY_BYTES) {
        this.outputChannel?.appendLine(
          '[distyl cache] safety valve: total ≥60 MB, skipping insert',
        );
        return;
      }

      // Read existing byte_size so delta is accurate on REPLACE.
      const existing = await dbGet<{ byte_size: number }>(
        this.db,
        `SELECT byte_size FROM embeddings
          WHERE content_hash = ? AND model_id = ? AND chunker_version = ?`,
        [key.contentHash, key.modelId, key.chunkerVersion],
      );
      const oldBytes = existing?.byte_size ?? 0;
      const newBytes = embedding.byteLength;

      const blob = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
      await dbRun(
        this.db,
        `INSERT OR REPLACE INTO embeddings
           (content_hash, model_id, chunker_version, embedding, byte_size, last_used)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [key.contentHash, key.modelId, key.chunkerVersion, blob, newBytes, Date.now()],
      );

      await dbRun(
        this.db,
        `UPDATE meta SET value = MAX(0, value + ?) WHERE key = 'total_bytes'`,
        [newBytes - oldBytes],
      );

      // Fire-and-forget eviction — caught at call site.
      this.evict().catch((err) =>
        this.outputChannel?.appendLine(`[distyl cache] eviction error: ${err}`),
      );
    } catch (err) {
      this.setFailures++;
      this.outputChannel?.appendLine(
        `[distyl cache] set() failed (${this.setFailures} this session): ${err}`,
      );
      throw err; // caller checks sessionSetFailures for toast at 3+
    }
  }

  get sessionSetFailures(): number {
    return this.setFailures;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      this.db.close((err) => (err ? reject(err) : resolve())),
    );
  }

  // ─── private ─────────────────────────────────────────────────────────────

  private async init(dbPath: string): Promise<void> {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = await openDb(dbPath);
    await dbRun(this.db, `
      CREATE TABLE IF NOT EXISTS embeddings (
        content_hash    TEXT    NOT NULL,
        model_id        TEXT    NOT NULL,
        chunker_version INTEGER NOT NULL,
        embedding       BLOB    NOT NULL,
        byte_size       INTEGER NOT NULL,
        last_used       INTEGER NOT NULL,
        PRIMARY KEY (content_hash, model_id, chunker_version)
      )`);
    await dbRun(this.db,
      `CREATE INDEX IF NOT EXISTS idx_embeddings_last_used ON embeddings(last_used)`);
    await dbRun(this.db, `
      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT    PRIMARY KEY,
        value INTEGER NOT NULL
      )`);
    await dbRun(this.db,
      `INSERT OR IGNORE INTO meta (key, value) VALUES ('total_bytes', 0)`);
  }

  private async evict(): Promise<void> {
    const meta = await dbGet<{ value: number }>(
      this.db,
      `SELECT value FROM meta WHERE key = 'total_bytes'`,
    );
    let total = meta?.value ?? 0;
    if (total <= EVICTION_BYTES) return;

    const rows = await dbAll<{
      content_hash: string; model_id: string; chunker_version: number; byte_size: number;
    }>(
      this.db,
      `SELECT content_hash, model_id, chunker_version, byte_size
         FROM embeddings ORDER BY last_used ASC`,
    );

    for (const row of rows) {
      if (total <= EVICTION_BYTES) break;
      await dbRun(
        this.db,
        `DELETE FROM embeddings
          WHERE content_hash = ? AND model_id = ? AND chunker_version = ?`,
        [row.content_hash, row.model_id, row.chunker_version],
      );
      total = Math.max(0, total - row.byte_size);
      await dbRun(
        this.db,
        `UPDATE meta SET value = ? WHERE key = 'total_bytes'`,
        [total],
      );
    }
  }
}

// ─── low-level SQLite helpers (promisify the callback API) ────────────────

function openDb(filePath: string): Promise<Database> {
  return new Promise((resolve, reject) => {
    const db = new Database(filePath, (err) => (err ? reject(err) : resolve(db)));
  });
}

function dbRun(db: Database, sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) =>
    db.run(sql, params, (err) => (err ? reject(err) : resolve())),
  );
}

function dbAll<T>(db: Database, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows as T[]))),
  );
}

function dbGet<T>(db: Database, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row as T | undefined))),
  );
}
