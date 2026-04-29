import type { ContextChunk } from '../../types';
import type { Ranker, BoostContext, ScoredChunk } from './types';
import { applyBoosts, topK, chunkId } from './shared';
import type { SqliteEmbeddingCache } from '../cache/sqlite';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const CHUNKER_VERSION = 1;
const EMBEDDING_DIM = 384;
const TOP_K = 20;
const NOISE_FLOOR = 0.1;

// Promise singleton — module-level so the preload survives across commands.
let preload: Promise<EmbedFn> | undefined;

type EmbedFn = (texts: string[]) => Promise<Float32Array[]>;

async function loadModel(): Promise<EmbedFn> {
  // @xenova/transformers is ESM-only. Using new Function prevents esbuild from
  // converting this to require() in the CJS bundle — the import() runs natively
  // in Electron/Node.js which supports ESM dynamic imports from CJS modules.
  type TransformersModule = { pipeline(task: string, model: string, opts?: Record<string, unknown>): Promise<(input: string | string[], opts?: Record<string, unknown>) => Promise<{ data: Float32Array }>> };
  const { pipeline } = await (new Function('return import("@xenova/transformers")')() as Promise<TransformersModule>);
  const extractor = await pipeline('feature-extraction', MODEL_ID, {
    quantized: false,
  });

  return async (texts: string[]): Promise<Float32Array[]> => {
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    // output.data is a flat Float32Array of shape [N, 384]
    const flat = output.data as Float32Array;
    return Array.from({ length: texts.length }, (_, i) =>
      flat.slice(i * EMBEDDING_DIM, (i + 1) * EMBEDDING_DIM),
    );
  };
}

/** Call once after onStartupFinished to warm the model before first command. */
export function preloadMiniLM(): void {
  if (!preload) preload = loadModel();
}

export class MiniLMRanker implements Ranker {
  constructor(private readonly cache?: SqliteEmbeddingCache) {
    // Start preload if not already running.
    if (!preload) preload = loadModel();
  }

  async score(
    prompt: string,
    chunks: ContextChunk[],
    ctx: BoostContext,
  ): Promise<ScoredChunk[]> {
    const embed = await preload!;

    // ── 1. Separate cache hits from misses ───────────────────────────────
    const keys = chunks.map((c) => ({
      contentHash: hashContent(c.content),
      modelId: MODEL_ID,
      chunkerVersion: CHUNKER_VERSION,
    }));
    const promptKey = {
      contentHash: hashContent(prompt),
      modelId: MODEL_ID,
      chunkerVersion: CHUNKER_VERSION,
    };

    const allKeys = [...keys, promptKey];
    const cached = this.cache ? await this.cache.get(allKeys) : new Map<string, Float32Array>();

    const { contentHash: promptHash } = promptKey;
    const promptCacheKey = `${promptHash}|${MODEL_ID}|${CHUNKER_VERSION}`;
    let promptEmbedding = cached.get(promptCacheKey);

    const missIndices: number[] = [];
    const chunkEmbeddings: (Float32Array | undefined)[] = keys.map((k, i) => {
      const key = `${k.contentHash}|${k.modelId}|${k.chunkerVersion}`;
      const hit = cached.get(key);
      if (!hit) missIndices.push(i);
      return hit;
    });
    const needsPromptEmbed = !promptEmbedding;

    // ── 2. Batch embed all misses + prompt (single forward pass) ─────────
    if (missIndices.length > 0 || needsPromptEmbed) {
      const texts: string[] = missIndices.map((i) => chunks[i].content);
      if (needsPromptEmbed) texts.push(prompt);

      const embeddings = await embed(texts);

      let ti = 0;
      for (const i of missIndices) {
        chunkEmbeddings[i] = embeddings[ti++];
      }
      if (needsPromptEmbed) {
        promptEmbedding = embeddings[ti];
      }

      // Write misses back to cache (fire-and-forget per set()).
      if (this.cache) {
        for (let j = 0; j < missIndices.length; j++) {
          const i = missIndices[j];
          const emb = chunkEmbeddings[i]!;
          this.cache.set(keys[i], emb).catch(() => { /* caller handles toast */ });
        }
        if (needsPromptEmbed && promptEmbedding) {
          this.cache.set(promptKey, promptEmbedding).catch(() => { /* caller handles toast */ });
        }
      }
    }

    // ── 3. Score via cosine similarity (embeddings are already normalized) ─
    const scored: ScoredChunk[] = chunks.map((chunk, i) => {
      const emb = chunkEmbeddings[i];
      const rawScore = emb && promptEmbedding
        ? dotProduct(emb, promptEmbedding)
        : 0;
      const boosted = applyBoosts(rawScore, chunk, ctx);
      return { ...chunk, chunkId: chunkId(chunk, i), score: boosted };
    });

    return topK(scored, TOP_K, NOISE_FLOOR);
  }
}

// ── helpers ───────────────────────────────────────────────────────────────

function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/** djb2 hash — fast, good enough for cache keying (not security-sensitive). */
function hashContent(content: string): string {
  let h = 5381;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) + h) ^ content.charCodeAt(i);
    h = h >>> 0; // keep 32-bit unsigned
  }
  return h.toString(16);
}
