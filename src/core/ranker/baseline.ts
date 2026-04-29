import type { ContextChunk } from '../../types';
import type { Ranker, BoostContext, ScoredChunk } from './types';
import { applyBoosts, topK, chunkId } from './shared';

const TOP_K = 20;
const NOISE_FLOOR = 0.1;

// Recency-based priority score per source type (higher = more relevant by default).
const SOURCE_PRIORITY: Record<string, number> = {
  'active-file': 1.0,
  'recent-edit': 0.8,
  'git-diff':    0.6,
  'git-log':     0.4,
  'git-branch':  0.3,
  'terminal':    0.5,
};

/**
 * Baseline ranker — no embeddings. Orders chunks by source priority, then
 * applies the same recency and proximity boosts as MiniLMRanker so golden
 * fixture comparisons are apples-to-apples for the boost logic.
 */
export class BaselineRanker implements Ranker {
  async score(
    _prompt: string,
    chunks: ContextChunk[],
    ctx: BoostContext,
  ): Promise<ScoredChunk[]> {
    const scored: ScoredChunk[] = chunks.map((chunk, i) => {
      const base = SOURCE_PRIORITY[chunk.source] ?? 0.2;
      const boosted = applyBoosts(base, chunk, ctx);
      return { ...chunk, chunkId: chunkId(chunk, i), score: boosted };
    });

    return topK(scored, TOP_K, NOISE_FLOOR);
  }
}
