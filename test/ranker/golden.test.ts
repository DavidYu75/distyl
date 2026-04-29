/**
 * Golden-output fixture tests.
 *
 * Fixture: 7 ContextChunks representing what the three Phase 1 collectors
 * would gather from a small "auth + parser" mini-repo. Timestamps are
 * fixed relative to a pinned NOW so recency boosts are reproducible.
 *
 * Snapshots capture RANK ORDER (top-5 chunkId arrays), not raw scores —
 * stable across platforms and floating-point rounding differences.
 *
 * Run: npm test
 * Update snapshots: npm test -- --update-snapshots
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { ContextChunk } from '../../src/types';
import type { BoostContext, ScoredChunk } from '../../src/core/ranker/types';
import { BaselineRanker } from '../../src/core/ranker/baseline';
import { MiniLMRanker, setEmbedFnForTesting } from '../../src/core/ranker/miniLM';

// ── fixture ──────────────────────────────────────────────────────────────

// Pinned so recency boosts (strict <5 min) are deterministic.
const NOW = 1_746_000_000_000;

const CHUNKS: ContextChunk[] = [
  {
    source: 'active-file',
    content: [
      '// auth.ts — authentication module',
      'function validateToken(token: string): boolean {',
      '  // BUG: timing attack — fix the auth bug',
      '  return token === process.env.SECRET_KEY;',
      '}',
      'function login(username: string, password: string): string | null {',
      '  return null;',
      '}',
    ].join('\n'),
    path: 'src/auth.ts',
    metadata: { language: 'typescript', timestamp: NOW - 60_000 },
  },
  {
    source: 'recent-edit',
    content: [
      '// parser.ts — expression parser',
      'class Parser {',
      '  parse(input: string): ASTNode {',
      '    return this.parseExpression();',
      '  }',
      '  // TODO: refactor the parser to use a visitor pattern',
      '  private parseExpression(): ASTNode { throw new Error(); }',
      '}',
    ].join('\n'),
    path: 'src/parser.ts',
    metadata: { language: 'typescript', timestamp: NOW - 120_000 },
  },
  {
    source: 'git-diff',
    content: [
      'diff --git a/src/auth.ts b/src/auth.ts',
      '--- a/src/auth.ts',
      '+++ b/src/auth.ts',
      '@@ -3,4 +3,5 @@',
      ' function validateToken(token: string): boolean {',
      '-  return token === process.env.SECRET_KEY;',
      '+  // fix: use timingSafeEqual to close the auth timing-attack bug',
      '+  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(process.env.SECRET_KEY ?? \'\'));',
      ' }',
    ].join('\n'),
    path: 'src/auth.ts',
    metadata: { timestamp: NOW - 30_000 },
  },
  {
    source: 'recent-edit',
    content: [
      '// auth.test.ts',
      "describe('validateToken', () => {",
      "  it('returns false for invalid tokens', () => {",
      "    expect(validateToken('bad')).toBe(false);",
      '  });',
      "  it('write a test for the timing-safe comparison', () => {",
      '    // TODO: write a test that catches timing attacks',
      '  });',
      '});',
    ].join('\n'),
    path: 'tests/auth.test.ts',
    metadata: { language: 'typescript', timestamp: NOW - 90_000 },
  },
  {
    source: 'recent-edit',
    content: [
      '// utils.ts — shared utilities',
      'function hashPassword(password: string): string {',
      "  return crypto.createHash('sha256').update(password).digest('hex');",
      '}',
    ].join('\n'),
    path: 'src/utils.ts',
    metadata: { language: 'typescript', timestamp: NOW - 600_000 },
  },
  {
    source: 'git-log',
    content: [
      'abc1234 fix: add constant-time comparison to auth module',
      'def5678 feat: implement parser visitor pattern',
      'ghi9012 test: write tests for the auth token validator',
    ].join('\n'),
  },
  {
    source: 'git-branch',
    content: 'fix/auth-timing-attack',
  },
];

const CTX: BoostContext = { activeFileUri: undefined, now: NOW };

// ── helpers ───────────────────────────────────────────────────────────────

function top5(chunks: ScoredChunk[]): string[] {
  return chunks.slice(0, 5).map((c) => c.chunkId);
}

// ── BaselineRanker ────────────────────────────────────────────────────────

describe('BaselineRanker — golden rank order', () => {
  const ranker = new BaselineRanker();

  it('prompt: fix the auth bug', async () => {
    const result = await ranker.score('fix the auth bug', CHUNKS, CTX);
    expect(top5(result)).toMatchSnapshot();
  });

  it('prompt: refactor the parser', async () => {
    const result = await ranker.score('refactor the parser', CHUNKS, CTX);
    expect(top5(result)).toMatchSnapshot();
  });

  it('prompt: write a test', async () => {
    const result = await ranker.score('write a test', CHUNKS, CTX);
    expect(top5(result)).toMatchSnapshot();
  });
});

// ── MiniLMRanker ─────────────────────────────────────────────────────────

describe('MiniLMRanker — golden rank order', () => {
  // Load @xenova/transformers via a regular import() so vite-node (Vitest's
  // module runner) can patch it — new Function() inside vm contexts cannot
  // use import(). setEmbedFnForTesting() injects the real embed function
  // before any score() calls, bypassing the new Function() path entirely.
  const ranker = new MiniLMRanker(undefined); // no cache — hermetic

  beforeAll(async () => {
    const DIM = 384;
    // @ts-expect-error — @xenova/transformers is ESM; vite-node loads it fine here
    const { pipeline } = await import('@xenova/transformers');
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: false,
    });
    setEmbedFnForTesting(async (texts: string[]) => {
      const output = await extractor(texts, { pooling: 'mean', normalize: true });
      const flat = output.data as Float32Array;
      return Array.from({ length: texts.length }, (_, i) =>
        flat.slice(i * DIM, (i + 1) * DIM),
      );
    });
  }, 120_000);

  it('prompt: fix the auth bug', { timeout: 120_000 }, async () => {
    const result = await ranker.score('fix the auth bug', CHUNKS, CTX);
    expect(top5(result)).toMatchSnapshot();
  });

  it('prompt: refactor the parser', { timeout: 120_000 }, async () => {
    const result = await ranker.score('refactor the parser', CHUNKS, CTX);
    expect(top5(result)).toMatchSnapshot();
  });

  it('prompt: write a test', { timeout: 120_000 }, async () => {
    const result = await ranker.score('write a test', CHUNKS, CTX);
    expect(top5(result)).toMatchSnapshot();
  });
});
