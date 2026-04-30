import type { OutputChannel } from 'vscode';
import type { Collector, ContextChunk } from '../types';
import type { Ranker, BoostContext } from './ranker/types';
import type { BudgetPreset } from './optimizer/packer';
import { pack } from './optimizer/packer';
import { countChunkTokens } from './optimizer/tokenCounter';
import { formatChunks } from '../format';

export type { BudgetPreset };

export interface ChunkTrace {
  chunkId: string;
  source: string;
  score: number;
  kept: boolean;
  reason: string;
}

export interface PipelineResult {
  payload: string;
  trace: ChunkTrace[];
  chunksIn: number;
  chunksKept: number;
  tokenCount: number;
  ranked: boolean;  // false → raw dump (no prompt, no ranker, or ranker failed)
}

export interface PipelineContext {
  collectors: Collector[];
  ranker?: Ranker;
  boostCtx: BoostContext;
  budget?: BudgetPreset;
  outputChannel?: OutputChannel;
}

const DEGRADED_MARKER =
  '<!-- distyl: ranking offline (init failed); raw dump only -->';
const SKIPPED_MARKER =
  '<!-- distyl: ranking skipped (no prompt); raw dump only -->';

export async function runPipeline(
  prompt: string,
  ctx: PipelineContext,
): Promise<PipelineResult> {
  const chunks = await gatherAll(ctx.collectors);
  const chunksIn = chunks.length;

  if (!prompt.trim() || !ctx.ranker) {
    const marker = prompt.trim() ? DEGRADED_MARKER : SKIPPED_MARKER;
    const payload = marker + '\n\n' + formatChunks(chunks);
    return { payload, trace: [], chunksIn, chunksKept: 0, tokenCount: 0, ranked: false };
  }

  let scored: import('./ranker/types').ScoredChunk[];
  try {
    scored = await ctx.ranker.score(prompt, chunks, ctx.boostCtx);
  } catch (err) {
    ctx.outputChannel?.appendLine(`[distyl] ranker failed: ${err}`);
    const payload = DEGRADED_MARKER + '\n\n' + formatChunks(chunks);
    return { payload, trace: [], chunksIn, chunksKept: 0, tokenCount: 0, ranked: false };
  }

  const budget = ctx.budget ?? 'standard';
  const packed = await pack(scored, budget);

  const tokenCount = (await Promise.all(packed.map(countChunkTokens))).reduce(
    (sum, t) => sum + t,
    0,
  );

  const packedIds = new Set(packed.map((c) => c.chunkId));
  const trace: ChunkTrace[] = scored.map((c) => ({
    chunkId: c.chunkId,
    source: c.source,
    score: c.score,
    kept: packedIds.has(c.chunkId),
    reason: packedIds.has(c.chunkId) ? 'scored' : 'budget-overflow',
  }));

  return {
    payload: formatChunks(packed),
    trace,
    chunksIn,
    chunksKept: packed.length,
    tokenCount,
    ranked: true,
  };
}

async function gatherAll(collectors: Collector[]): Promise<ContextChunk[]> {
  const results = await Promise.allSettled(
    collectors.map((c) => c.collect()),
  );
  const chunks: ContextChunk[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') chunks.push(...r.value);
  }
  return chunks;
}
