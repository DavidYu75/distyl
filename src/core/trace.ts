import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { OutputChannel } from 'vscode';
import type { ChunkTrace } from './pipeline';

const LOG_DIR  = path.join(os.homedir(), '.distyl');
const LOG_PATH = path.join(LOG_DIR, 'log.jsonl');

export interface TraceEntry {
  ts:             number;   // Unix ms
  prompt:         string;
  chunks_in:      number;
  chunks_kept:    number;
  chunks_dropped: number;
  top_scores:     number[]; // scores of kept chunks, descending
  elapsed_ms:     number;
}

/**
 * Appends one JSON line to ~/.distyl/log.jsonl.
 * Fire-and-forget — errors are logged to OutputChannel, never thrown.
 */
export function writeTrace(
  entry: TraceEntry,
  outputChannel?: OutputChannel,
): void {
  const line = JSON.stringify(entry) + '\n';
  fs.mkdir(LOG_DIR, { recursive: true }, (mkdirErr) => {
    if (mkdirErr) {
      outputChannel?.appendLine(`[distyl trace] mkdir failed: ${mkdirErr}`);
      return;
    }
    fs.appendFile(LOG_PATH, line, (appendErr) => {
      if (appendErr) {
        outputChannel?.appendLine(`[distyl trace] write failed: ${appendErr}`);
      }
    });
  });
}

/**
 * Renders the per-chunk decision table to the OutputChannel.
 * Called after every successful ranked run so the user can see what was kept.
 */
export function renderTrace(
  trace: ChunkTrace[],
  prompt: string,
  elapsed_ms: number,
  outputChannel: OutputChannel,
): void {
  outputChannel.appendLine('');
  outputChannel.appendLine(`── Distyl trace ── prompt: "${truncate(prompt, 60)}" (${elapsed_ms} ms)`);

  if (trace.length === 0) {
    outputChannel.appendLine('  (raw dump — ranking skipped or offline)');
    return;
  }

  const kept    = trace.filter((c) => c.kept);
  const dropped = trace.filter((c) => !c.kept);

  for (const c of kept) {
    outputChannel.appendLine(
      `  ✓  ${pad(c.source, 14)}  score=${c.score.toFixed(3)}  ${c.chunkId}`,
    );
  }
  for (const c of dropped) {
    outputChannel.appendLine(
      `  ✗  ${pad(c.source, 14)}  score=${c.score.toFixed(3)}  ${c.chunkId}  (${c.reason})`,
    );
  }

  outputChannel.appendLine(
    `  kept ${kept.length} / ${trace.length} chunks`,
  );
}

// ── helpers ───────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}
