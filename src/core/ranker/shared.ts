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

  // Proximity: chunk is in the same immediate directory as the active file.
  // activeFileUri.fsPath is absolute; chunk.path is relative (from asRelativePath).
  // Comparing full paths would never match, so we compare the last directory
  // segment (immediate parent folder name) of each. False positives are possible
  // if two different locations share a folder name (e.g., two "src" dirs), which
  // is an accepted V1 approximation.
  if (ctx.activeFileUri && chunk.path) {
    const activeSeg = lastSeg(dirOf(ctx.activeFileUri));
    const chunkSeg  = lastSeg(dirOf(chunk.path));
    if (activeSeg && chunkSeg && normalizeDir(activeSeg) === normalizeDir(chunkSeg)) {
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

function lastSeg(dir: string): string {
  return dir.split(/[/\\]/).pop() ?? '';
}

// Normalize path separators so Windows paths compare correctly.
function normalizeDir(dir: string): string {
  return dir.replace(/\\/g, '/').toLowerCase();
}
