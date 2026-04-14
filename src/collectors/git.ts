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
      chunks.push({
        source: "git-diff",
        content: truncateLines(diff, MAX_DIFF_LINES),
      });
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
