import { describe, it, expect, vi } from 'vitest';
import type { Collector, ContextChunk } from '../../src/types';
import type { Ranker, BoostContext, ScoredChunk } from '../../src/core/ranker/types';
import { runPipeline } from '../../src/core/pipeline';

const CTX: BoostContext = { now: Date.now() };

function makeChunk(source: ContextChunk['source'] = 'git-branch'): ContextChunk {
  return { source, content: 'content' };
}

function makeCollector(chunks: ContextChunk[]): Collector {
  return { name: 'mock', collect: async () => chunks };
}

function makeRanker(scored: ScoredChunk[]): Ranker {
  return { score: async () => scored };
}

describe('runPipeline', () => {
  it('returns raw dump with SKIPPED_MARKER when prompt is empty', async () => {
    const result = await runPipeline('', {
      collectors: [makeCollector([makeChunk()])],
      ranker: makeRanker([]),
      boostCtx: CTX,
    });
    expect(result.payload).toContain('ranking skipped');
    expect(result.ranked).toBe(false);
    expect(result.trace).toHaveLength(0);
  });

  it('returns raw dump with SKIPPED_MARKER when prompt is whitespace', async () => {
    const result = await runPipeline('   ', {
      collectors: [makeCollector([makeChunk()])],
      ranker: makeRanker([]),
      boostCtx: CTX,
    });
    expect(result.payload).toContain('ranking skipped');
    expect(result.ranked).toBe(false);
  });

  it('returns raw dump with DEGRADED_MARKER when no ranker provided', async () => {
    const result = await runPipeline('fix the bug', {
      collectors: [makeCollector([makeChunk()])],
      boostCtx: CTX,
    });
    expect(result.payload).toContain('ranking offline');
    expect(result.ranked).toBe(false);
  });

  it('returns raw dump with DEGRADED_MARKER when ranker.score() throws', async () => {
    const failingRanker: Ranker = {
      score: async () => { throw new Error('model exploded'); },
    };
    const result = await runPipeline('fix the bug', {
      collectors: [makeCollector([makeChunk()])],
      ranker: failingRanker,
      boostCtx: CTX,
    });
    expect(result.payload).toContain('ranking offline');
    expect(result.ranked).toBe(false);
  });

  it('returns ranked payload with ranked: true when ranker succeeds', async () => {
    const chunk = makeChunk();
    const scored: ScoredChunk = { ...chunk, chunkId: 'git-branch::0', score: 0.8 };
    const result = await runPipeline('fix the bug', {
      collectors: [makeCollector([chunk])],
      ranker: makeRanker([scored]),
      boostCtx: CTX,
    });
    expect(result.ranked).toBe(true);
    expect(result.trace).toHaveLength(1);
    expect(result.trace[0].kept).toBe(true);
    expect(result.trace[0].score).toBe(0.8);
  });

  it('chunksIn reflects total gathered chunks before ranking', async () => {
    const chunks = [makeChunk(), makeChunk('git-log')];
    const result = await runPipeline('fix the bug', {
      collectors: [makeCollector(chunks)],
      ranker: makeRanker([]),
      boostCtx: CTX,
    });
    expect(result.chunksIn).toBe(2);
  });

  it('gatherAll: a failing collector does not prevent other collectors from running', async () => {
    const failingCollector: Collector = {
      name: 'boom',
      collect: async () => { throw new Error('kaboom'); },
    };
    const goodChunk = makeChunk();
    const result = await runPipeline('fix the bug', {
      collectors: [failingCollector, makeCollector([goodChunk])],
      ranker: makeRanker([]),
      boostCtx: CTX,
    });
    // chunksIn = 1 from the good collector; failing collector was swallowed
    expect(result.chunksIn).toBe(1);
  });
});
