import * as vscode from "vscode";
import { execFile } from "child_process";
import { promisify } from "util";
import { Collector, ContextChunk } from "../types";

const execFileAsync = promisify(execFile);

const MAX_DIFF_LINES = 200;
const MAX_LOG_COMMITS = 10;
const MAX_BUFFER = 10 * 1024 * 1024;

export class GitCollector implements Collector {
  readonly name = "git";

  async collect(): Promise<ContextChunk[]> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) return [];

    if (!(await this.isGitRepo(cwd))) return [];

    const chunks: ContextChunk[] = [];

    const branch = await this.run(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (branch && branch.trim()) {
      chunks.push({
        source: "git-branch",
        content: branch.trim(),
      });
    }

    const diff = await this.run(cwd, ["diff", "HEAD"]);
    if (diff && diff.trim()) {
      chunks.push(...splitDiffHunks(diff));
    }

    const log = await this.run(cwd, [
      "log",
      "--oneline",
      `-n`,
      String(MAX_LOG_COMMITS),
    ]);
    if (log && log.trim()) {
      chunks.push({
        source: "git-log",
        content: log.trim(),
      });
    }

    return chunks;
  }

  private async isGitRepo(cwd: string): Promise<boolean> {
    const out = await this.run(cwd, ["rev-parse", "--is-inside-work-tree"]);
    return out?.trim() === "true";
  }

  private async run(cwd: string, args: string[]): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync("git", args, {
        cwd,
        maxBuffer: MAX_BUFFER,
      });
      return stdout;
    } catch {
      return null;
    }
  }
}

function truncateLines(text: string, maxLines: number): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  const kept = lines.slice(0, maxLines).join("\n");
  return `${kept}\n... [truncated ${lines.length - maxLines} more lines]`;
}

function splitDiffHunks(diff: string): import("../types").ContextChunk[] {
  const chunks: import("../types").ContextChunk[] = [];

  // Split into per-file sections at each "diff --git" boundary.
  const fileSections = diff.split(/(?=^diff --git )/m);

  for (const section of fileSections) {
    if (!section.trim()) continue;

    // Extract the file path from the "+++ b/<path>" line.
    const pathMatch = section.match(/^\+\+\+ b\/(.+)$/m);
    const filePath = pathMatch?.[1];

    // Split into file header + individual hunks at each "@@ " boundary.
    const parts = section.split(/(?=^@@ )/m);
    const fileHeader = parts[0];

    if (parts.length === 1) {
      // No @@ markers — include the whole section as a single chunk.
      chunks.push({
        source: "git-diff",
        content: truncateLines(fileHeader.trim(), MAX_DIFF_LINES),
        path: filePath,
      });
      continue;
    }

    for (let i = 1; i < parts.length; i++) {
      chunks.push({
        source: "git-diff",
        content: truncateLines(
          (fileHeader + parts[i]).trim(),
          MAX_DIFF_LINES,
        ),
        path: filePath,
      });
    }
  }

  // Fallback: if nothing parsed, return the whole diff as one chunk.
  return chunks.length > 0
    ? chunks
    : [{ source: "git-diff", content: truncateLines(diff, MAX_DIFF_LINES) }];
}
