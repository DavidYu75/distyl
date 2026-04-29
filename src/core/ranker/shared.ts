import type { ContextChunk } from '../../types';
import type { BoostContext, ScoredChunk } from './types';

const RECENCY_BOOST = 1.3;
const PROXIMITY_BOOST = 1.2;
const RECENCY_WINDOW_MS = 5 * 60 * 1000; // strict < 5 min

export function applyBoosts(
  rawScore: number,
  chunk: ContextChunk,
  ctx: BoostContext,
): number {
  let score = rawScore;

  // Recency: strict less-than 5 min, step function.
  const ts = chunk.metadata?.timestamp;
  if (ts !== undefined && ts + RECENCY_WINDOW_MS > ctx.now) {
    score *= RECENCY_BOOST;
  }

  // Proximity: same directory as the active file.
  if (ctx.activeFileUri && chunk.path) {
    const activeDir = dirOf(ctx.activeFileUri.fsPath);
    const chunkDir = dirOf(chunk.path);
    if (activeDir && chunkDir && normalizeDir(activeDir) === normalizeDir(chunkDir)) {
      score *= PROXIMITY_BOOST;
    }
  }

  return score;
}

export function topK(chunks: ScoredChunk[], k: number, noiseFloor: number): ScoredChunk[] {
  return chunks
    .filter((c) => c.score > noiseFloor)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export function chunkId(chunk: ContextChunk, index: number): string {
  return `${chunk.source}:${chunk.path ?? ''}:${index}`;
}

// ── path helpers ──────────────────────────────────────────────────────────

function dirOf(filePath: string): string {
  const sep = filePath.includes('/') ? '/' : '\\';
  const parts = filePath.split(/[/\\]/);
  parts.pop(); // remove filename
  return parts.join(sep);
}

// Normalize path separators so Windows paths compare correctly.
function normalizeDir(dir: string): string {
  return dir.replace(/\\/g, '/').toLowerCase();
}
