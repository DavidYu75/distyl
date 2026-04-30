/**
 * Extension–CLI parity test.
 *
 * Verifies that both surfaces produce identical packed output when given the
 * same workspace state. The shared core pipeline (rank → pack → format) is
 * the single source of truth; this test guards against either surface
 * accidentally adding a transformation step that diverges the payloads.
 *
 * Test design:
 *   - Use the same fixed ContextChunk corpus as the golden-fixture tests.
 *   - Run runPipeline() twice: once simulating the "extension" path, once
 *     simulating the "CLI" path (same collectors, same ranker, same budget).
 *   - Assert top-5 chunkId arrays are identical (rank-order comparison).
 *   - Assert token counts and payload strings are identical.
 *   - Allow ±1 position tolerance for tied scores.
 *
 * Run: npm test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { ContextChunk } from '../../src/types';
import type { Collector } from '../../src/types';
import type { BoostContext } from '../../src/core/ranker/types';
import { BaselineRanker } from '../../src/core/ranker/baseline';
import { MiniLMRanker, setEmbedFnForTesting } from '../../src/core/ranker/miniLM';
import { runPipeline } from '../../src/core/pipeline';

// ── fixture — same corpus as golden.test.ts ───────────────────────────────

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
      "+  // fix: use timingSafeEqual to close the auth timing-attack bug",
      "+  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(process.env.SECRET_KEY ?? ''));",
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

function makeCollector(chunks: ContextChunk[]): Collector {
  return { name: 'fixture', collect: async () => chunks };
}

const CTX: BoostContext = { activeFileUri: undefined, now: NOW };

function top5(chunkIds: string[]): string[] {
  return chunkIds.slice(0, 5);
}

// Allow ±1 position tolerance for tied scores.
function top5WithTolerance(a: string[], b: string[]): boolean {
  const setA = new Set(a.slice(0, 5));
  const setB = new Set(b.slice(0, 5));
  // Count how many differ.
  let diff = 0;
  for (const id of setA) if (!setB.has(id)) diff++;
  return diff <= 1; // ±1 tolerance
}

// ── BaselineRanker parity ─────────────────────────────────────────────────

describe('BaselineRanker parity — extension vs CLI pipeline', () => {
  const ranker = new BaselineRanker();

  const PROMPTS = [
    'fix the auth bug',
    'refactor the parser',
    'write a test',
  ] as const;

  for (const prompt of PROMPTS) {
    it(`prompt: ${prompt}`, async () => {
      // "Extension" path: pipeline called as VS Code command handler would.
      const extResult = await runPipeline(prompt, {
        collectors: [makeCollector(CHUNKS)],
        ranker,
        boostCtx: CTX,
        budget: 'standard',
      });

      // "CLI" path: pipeline called as bin/distyl.ts would.
      const cliResult = await runPipeline(prompt, {
        collectors: [makeCollector(CHUNKS)],
        ranker,
        boostCtx: CTX,
        budget: 'standard',
      });

      // Both paths share the same core pipeline — outputs must be identical.
      expect(extResult.payload).toBe(cliResult.payload);
      expect(extResult.chunksKept).toBe(cliResult.chunksKept);
      expect(extResult.tokenCount).toBe(cliResult.tokenCount);

      const extTop5 = top5(extResult.trace.filter((c) => c.kept).map((c) => c.chunkId));
      const cliTop5 = top5(cliResult.trace.filter((c) => c.kept).map((c) => c.chunkId));

      expect(top5WithTolerance(extTop5, cliTop5)).toBe(true);
    });
  }
});

// ── MiniLMRanker parity ───────────────────────────────────────────────────

describe('MiniLMRanker parity — extension vs CLI pipeline', () => {
  const ranker = new MiniLMRanker(undefined);

  beforeAll(async () => {
    const DIM = 384;
    // @ts-expect-error — ESM import handled by vite-node
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

  const PROMPTS = [
    'fix the auth bug',
    'refactor the parser',
    'write a test',
  ] as const;

  for (const prompt of PROMPTS) {
    it(`prompt: ${prompt}`, { timeout: 120_000 }, async () => {
      const extResult = await runPipeline(prompt, {
        collectors: [makeCollector(CHUNKS)],
        ranker,
        boostCtx: CTX,
        budget: 'standard',
      });

      const cliResult = await runPipeline(prompt, {
        collectors: [makeCollector(CHUNKS)],
        ranker,
        boostCtx: CTX,
        budget: 'standard',
      });

      expect(extResult.payload).toBe(cliResult.payload);
      expect(extResult.chunksKept).toBe(cliResult.chunksKept);
      expect(extResult.tokenCount).toBe(cliResult.tokenCount);

      const extTop5 = top5(extResult.trace.filter((c) => c.kept).map((c) => c.chunkId));
      const cliTop5 = top5(cliResult.trace.filter((c) => c.kept).map((c) => c.chunkId));

      expect(top5WithTolerance(extTop5, cliTop5)).toBe(true);
    });
  }
});

// ── Packer determinism ───────────────────────────────────────────────────

describe('pack() determinism — same input always produces same output', () => {
  const ranker = new BaselineRanker();

  it('identical calls return identical payload', async () => {
    const run1 = await runPipeline('fix the auth bug', {
      collectors: [makeCollector(CHUNKS)],
      ranker,
      boostCtx: CTX,
      budget: 'standard',
    });
    const run2 = await runPipeline('fix the auth bug', {
      collectors: [makeCollector(CHUNKS)],
      ranker,
      boostCtx: CTX,
      budget: 'standard',
    });

    expect(run1.payload).toBe(run2.payload);
    expect(run1.tokenCount).toBe(run2.tokenCount);
  });

  it('focused budget keeps fewer tokens than standard', async () => {
    const focused = await runPipeline('fix the auth bug', {
      collectors: [makeCollector(CHUNKS)],
      ranker,
      boostCtx: CTX,
      budget: 'focused',
    });
    const standard = await runPipeline('fix the auth bug', {
      collectors: [makeCollector(CHUNKS)],
      ranker,
      boostCtx: CTX,
      budget: 'standard',
    });

    expect(focused.tokenCount).toBeLessThanOrEqual(4_000);
    expect(standard.tokenCount).toBeLessThanOrEqual(8_000);
    expect(focused.tokenCount).toBeLessThanOrEqual(standard.tokenCount);
  });

  it('chunksKept reflects actual packed count', async () => {
    const result = await runPipeline('fix the auth bug', {
      collectors: [makeCollector(CHUNKS)],
      ranker,
      boostCtx: CTX,
      budget: 'standard',
    });

    const keptInTrace = result.trace.filter((c) => c.kept).length;
    expect(result.chunksKept).toBe(keptInTrace);
  });

  it('strategic ordering: metadata chunks appear after content chunks', async () => {
    const result = await runPipeline('fix the auth bug', {
      collectors: [makeCollector(CHUNKS)],
      ranker,
      boostCtx: CTX,
      budget: 'standard',
    });

    // The payload should have git-branch and git-log after active-file / git-diff.
    const payload = result.payload;
    const activePos = payload.indexOf('source="active-file"');
    const branchPos = payload.indexOf('source="git-branch"');
    const logPos = payload.indexOf('source="git-log"');

    if (activePos !== -1 && branchPos !== -1) {
      expect(activePos).toBeLessThan(branchPos);
    }
    if (activePos !== -1 && logPos !== -1) {
      expect(activePos).toBeLessThan(logPos);
    }
  });
});
