import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CliActiveFileCollector } from '../src/cli/collectors/activeFile';
import { CliRecentEditsCollector } from '../src/cli/collectors/recentEdits';
import { collectGit } from '../src/collectors/gitImpl';
import { BaselineRanker } from '../src/core/ranker/baseline';
import { MiniLMRanker, preloadMiniLM } from '../src/core/ranker/miniLM';
import { runPipeline } from '../src/core/pipeline';
import type { BudgetPreset } from '../src/core/pipeline';
import type { Collector } from '../src/types';

const DEGRADED_MARKER =
  '<!-- distyl: ranking offline (init failed); raw dump only -->';

const program = new Command();

program
  .name('distyl')
  .description(
    'Distil workspace context into a token-budgeted payload for AI prompts.\n\n' +
    'First run downloads MiniLM weights (~80 MB) from HuggingFace — this takes\n' +
    '3–10 seconds. Subsequent runs are fast (<1s) once the embedding cache is warm.',
  )
  .requiredOption('-p, --prompt <text>', 'The AI prompt you are about to send')
  .option(
    '--budget <preset>',
    'Token budget: focused (4k), standard (8k, default), deep (16k)',
    'standard',
  )
  .option('--clipboard', 'Copy output to clipboard instead of writing to stdout')
  .option('--baseline', 'Use BaselineRanker (no embeddings, faster cold start)');

program.parse(process.argv);

const opts = program.opts<{
  prompt: string;
  budget: string;
  clipboard: boolean;
  baseline: boolean;
}>();

async function main() {
  const prompt = opts.prompt;
  const budget = opts.budget as BudgetPreset;
  const useClipboard = !!opts.clipboard;
  const useBaseline = !!opts.baseline;

  // Discover git root (walk up from cwd looking for .git).
  const gitRoot = findGitRoot(process.cwd()) ?? process.cwd();

  // Instantiate collectors.
  const activeCollector = new CliActiveFileCollector(gitRoot);

  // Discover the active file so recent-edits can exclude it.
  const activeChunks = await activeCollector.collect();
  const activeFilePath = activeChunks[0]
    ? path.join(gitRoot, activeChunks[0].path ?? '')
    : undefined;

  const cliGitCollector: Collector = {
    name: 'cli-git',
    collect: () => collectGit(gitRoot),
  };

  const collectors: Collector[] = [
    activeCollector,
    new CliRecentEditsCollector(gitRoot, activeFilePath),
    cliGitCollector,
  ];

  // Instantiate ranker.
  let ranker;
  if (useBaseline) {
    ranker = new BaselineRanker();
  } else {
    // Preload MiniLM in background; first score() call awaits the same promise.
    preloadMiniLM();
    ranker = new MiniLMRanker(undefined); // no cache in CLI — embeddings recomputed each run
  }

  const boostCtx = {
    activeFileUri: activeFilePath,
    now: Date.now(),
  };

  let result;
  try {
    result = await runPipeline(prompt, {
      collectors,
      ranker,
      boostCtx,
      budget,
    });
  } catch (err) {
    // Pipeline-level failure — emit degraded marker and exit.
    const degraded = DEGRADED_MARKER + `\n<!-- error: ${err} -->`;
    await writeOutput(degraded, useClipboard);
    process.exit(1);
  }

  if (!result.ranked) {
    // Soft-fallback path; payload already contains the DEGRADED_MARKER.
    await writeOutput(result.payload, useClipboard);
    return;
  }

  // Emit trace note to stderr so stdout stays clean for piping.
  process.stderr.write(
    `[distyl] ${result.chunksIn} chunks in → ${result.chunksKept} kept → ${result.tokenCount} tokens (${budget})\n` +
    `         recent-edits approximate in CLI mode (mtime-based, 24h window)\n`,
  );

  await writeOutput(result.payload, useClipboard);
}

async function writeOutput(payload: string, useClipboard: boolean): Promise<void> {
  if (!useClipboard) {
    process.stdout.write(payload + '\n');
    return;
  }

  // Dynamic require so non-clipboard path doesn't pull this in.
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    if (process.platform === 'darwin') {
      const child = execFile('pbcopy');
      child.stdin!.write(payload);
      child.stdin!.end();
      await new Promise<void>((resolve, reject) => {
        child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`pbcopy exited ${code}`))));
      });
    } else if (process.platform === 'linux') {
      await execFileAsync('xclip', ['-selection', 'clipboard'], { input: payload } as never);
    } else if (process.platform === 'win32') {
      const child = execFile('clip');
      child.stdin!.write(payload);
      child.stdin!.end();
      await new Promise<void>((resolve, reject) => {
        child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`clip exited ${code}`))));
      });
    } else {
      process.stdout.write(payload + '\n');
    }
  } catch (err) {
    process.stderr.write(`[distyl] clipboard write failed: ${err}\n`);
    process.stdout.write(payload + '\n');
  }
}

function findGitRoot(start: string): string | null {
  let dir = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null; // filesystem root
    dir = parent;
  }
}

main().catch((err) => {
  process.stderr.write(`[distyl] fatal: ${err}\n`);
  process.exit(1);
});
