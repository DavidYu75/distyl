import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ContextChunk } from '../types';

const execFileAsync = promisify(execFile);

const MAX_DIFF_LINES = 200;
const MAX_LOG_COMMITS = 10;
const MAX_BUFFER = 10 * 1024 * 1024;

/**
 * Node-safe git collection. Used by both the VS Code GitCollector (which
 * obtains cwd from the workspace API) and the CLI git collector (cwd from
 * git root discovery).
 */
export async function collectGit(cwd: string): Promise<ContextChunk[]> {
  if (!(await isGitRepo(cwd))) return [];

  const chunks: ContextChunk[] = [];

  const branch = await run(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch && branch.trim()) {
    chunks.push({ source: 'git-branch', content: branch.trim() });
  }

  const diff = await run(cwd, ['diff', 'HEAD']);
  if (diff && diff.trim()) {
    chunks.push(...splitDiffHunks(diff));
  }

  const log = await run(cwd, ['log', '--oneline', '-n', String(MAX_LOG_COMMITS)]);
  if (log && log.trim()) {
    chunks.push({ source: 'git-log', content: log.trim() });
  }

  return chunks;
}

async function isGitRepo(cwd: string): Promise<boolean> {
  const out = await run(cwd, ['rev-parse', '--is-inside-work-tree']);
  return out?.trim() === 'true';
}

async function run(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd, maxBuffer: MAX_BUFFER });
    return stdout;
  } catch {
    return null;
  }
}

function truncateLines(text: string, maxLines: number): string {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  const kept = lines.slice(0, maxLines).join('\n');
  return `${kept}\n... [truncated ${lines.length - maxLines} more lines]`;
}

export function splitDiffHunks(diff: string): ContextChunk[] {
  const chunks: ContextChunk[] = [];

  const fileSections = diff.split(/(?=^diff --git )/m);

  for (const section of fileSections) {
    if (!section.trim()) continue;

    const pathMatch = section.match(/^\+\+\+ b\/(.+)$/m);
    const filePath = pathMatch?.[1];

    const parts = section.split(/(?=^@@ )/m);
    const fileHeader = parts[0];

    if (parts.length === 1) {
      chunks.push({
        source: 'git-diff',
        content: truncateLines(fileHeader.trim(), MAX_DIFF_LINES),
        path: filePath,
      });
      continue;
    }

    for (let i = 1; i < parts.length; i++) {
      chunks.push({
        source: 'git-diff',
        content: truncateLines((fileHeader + parts[i]).trim(), MAX_DIFF_LINES),
        path: filePath,
      });
    }
  }

  return chunks.length > 0
    ? chunks
    : [{ source: 'git-diff', content: truncateLines(diff, MAX_DIFF_LINES) }];
}
