import type { ScoredChunk } from '../ranker/types';
import { countChunkTokens } from './tokenCounter';

export type BudgetPreset = 'focused' | 'standard' | 'deep';

const BUDGET_TOKENS: Record<BudgetPreset, number> = {
  focused:  4_000,
  standard: 8_000,
  deep:     16_000,
};

// Source types → output tier (1 = first/lede, 2 = middle, 3 = last/metadata).
const SOURCE_TIER: Record<string, 1 | 2 | 3> = {
  'active-file': 1,
  'git-diff':    1,
  'recent-edit': 2,
  'terminal':    2,
  'git-branch':  3,
  'git-log':     3,
};

function tierOf(source: string): 1 | 2 | 3 {
  return SOURCE_TIER[source] ?? 2;
}

/**
 * Greedily selects chunks that fit within the token budget (highest score
 * first), then re-orders the kept set for optimal model attention:
 *
 *   Tier 1 (active-file, git-diff)   — relevance-first / lede
 *   Tier 2 (recent-edit, terminal)   — supporting context / middle
 *   Tier 3 (git-branch, git-log)     — metadata / tail
 *
 * Within each tier ties break by recency (timestamp desc).
 * Chunks that do not fit the remaining budget are SKIPPED (never truncated).
 */
export async function pack(chunks: ScoredChunk[], budget: BudgetPreset): Promise<ScoredChunk[]> {
  const limit = BUDGET_TOKENS[budget];

  // Greedy selection — iterate score-descending (ranker already returns this order).
  const sorted = [...chunks].sort((a, b) => b.score - a.score);

  // Count tokens for all chunks in parallel.
  const tokenCounts = await Promise.all(sorted.map(countChunkTokens));

  let remaining = limit;
  const kept: ScoredChunk[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const tokens = tokenCounts[i];
    if (tokens <= remaining) {
      kept.push(sorted[i]);
      remaining -= tokens;
    }
    // Skip-on-overflow: try the next chunk regardless.
  }

  // Strategic output ordering.
  kept.sort((a, b) => {
    const tierDiff = tierOf(a.source) - tierOf(b.source);
    if (tierDiff !== 0) return tierDiff;
    // Within tier: score desc, then recency desc.
    const scoreDiff = b.score - a.score;
    if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;
    const ta = a.metadata?.timestamp ?? 0;
    const tb = b.metadata?.timestamp ?? 0;
    return tb - ta;
  });

  return kept;
}
