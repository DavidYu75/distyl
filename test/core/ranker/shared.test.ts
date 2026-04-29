import { describe, it, expect } from 'vitest';
import * as vscodeMock from 'vscode';
import type { ContextChunk } from '../../../src/types';
import type { ScoredChunk, BoostContext } from '../../../src/core/ranker/types';
import { applyBoosts, topK, chunkId } from '../../../src/core/ranker/shared';

const NOW = 1_746_000_000_000;

function makeChunk(overrides: Partial<ContextChunk> = {}): ContextChunk {
  return { source: 'recent-edit', content: 'hello', ...overrides };
}

function makeScored(score: number, overrides: Partial<ScoredChunk> = {}): ScoredChunk {
  return { source: 'recent-edit', content: 'hello', chunkId: 'x', score, ...overrides };
}

describe('applyBoosts', () => {
  it('returns score unchanged when no timestamp and no active file', () => {
    const ctx: BoostContext = { now: NOW };
    expect(applyBoosts(0.5, makeChunk(), ctx)).toBeCloseTo(0.5);
  });

  it('applies recency boost (1.3×) when timestamp is within 5 minutes', () => {
    const ctx: BoostContext = { now: NOW };
    const chunk = makeChunk({ metadata: { timestamp: NOW - 4 * 60 * 1000 } });
    expect(applyBoosts(0.5, chunk, ctx)).toBeCloseTo(0.5 * 1.3);
  });

  it('does NOT apply recency boost when timestamp is exactly 5 minutes old', () => {
    const ctx: BoostContext = { now: NOW };
    const chunk = makeChunk({ metadata: { timestamp: NOW - 5 * 60 * 1000 } });
    // strict < 5 min: timestamp + 300_000 === NOW is NOT > NOW
    expect(applyBoosts(0.5, chunk, ctx)).toBeCloseTo(0.5);
  });

  it('applies proximity boost (1.2×) when chunk is in the same directory as active file', () => {
    const activeUri = vscodeMock.Uri.file('/workspace/src/foo.ts');
    const ctx: BoostContext = { activeFileUri: activeUri, now: NOW };
    const chunk = makeChunk({ path: 'src/bar.ts' });
    expect(applyBoosts(0.5, chunk, ctx)).toBeCloseTo(0.5 * 1.2);
  });

  it('does NOT apply proximity boost when chunk is in a different directory', () => {
    const activeUri = vscodeMock.Uri.file('/workspace/src/foo.ts');
    const ctx: BoostContext = { activeFileUri: activeUri, now: NOW };
    const chunk = makeChunk({ path: 'tests/bar.test.ts' });
    expect(applyBoosts(0.5, chunk, ctx)).toBeCloseTo(0.5);
  });

  it('stacks recency and proximity boosts multiplicatively (1.3 × 1.2)', () => {
    const activeUri = vscodeMock.Uri.file('/workspace/src/foo.ts');
    const ctx: BoostContext = { activeFileUri: activeUri, now: NOW };
    const chunk = makeChunk({
      path: 'src/bar.ts',
      metadata: { timestamp: NOW - 60_000 },
    });
    expect(applyBoosts(0.5, chunk, ctx)).toBeCloseTo(0.5 * 1.3 * 1.2);
  });
});

describe('topK', () => {
  it('filters chunks below the noise floor', () => {
    const chunks = [
      makeScored(0.5),
      makeScored(0.05), // below 0.1
      makeScored(0.8),
    ];
    expect(topK(chunks, 10, 0.1)).toHaveLength(2);
  });

  it('sorts remaining chunks descending by score', () => {
    const chunks = [makeScored(0.3), makeScored(0.9), makeScored(0.6)];
    const result = topK(chunks, 10, 0.1);
    expect(result.map((c) => c.score)).toEqual([0.9, 0.6, 0.3]);
  });

  it('slices to at most K chunks', () => {
    const chunks = Array.from({ length: 10 }, (_, i) => makeScored(0.5 + i * 0.01));
    expect(topK(chunks, 3, 0.1)).toHaveLength(3);
  });
});

describe('chunkId', () => {
  it('formats as source:path:index', () => {
    const chunk = makeChunk({ path: 'src/foo.ts' });
    expect(chunkId(chunk, 2)).toBe('recent-edit:src/foo.ts:2');
  });

  it('uses empty string for missing path', () => {
    expect(chunkId(makeChunk(), 0)).toBe('recent-edit::0');
  });
});
