import * as vscode from "vscode";
import { ActiveFileCollector } from "./collectors/activeFile";
import { GitCollector } from "./collectors/git";
import { RecentEditsCollector } from "./collectors/recentEdits";
import { formatChunks } from "./format";
import { Collector } from "./types";

function formatAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("Distyl");
  context.subscriptions.push(output);

  const recentEdits = new RecentEditsCollector();
  context.subscriptions.push(recentEdits);

  const collectors: Collector[] = [
    new ActiveFileCollector(),
    recentEdits,
    new GitCollector(),
  ];

  const disposable = vscode.commands.registerCommand(
    "distyl.gatherContext",
    async () => {
      const results = await Promise.all(collectors.map((c) => c.collect()));
      const chunks = results.flat();
      const now = Date.now();

      const payload = formatChunks(chunks);
      await vscode.env.clipboard.writeText(payload);

      output.clear();
      output.appendLine(
        `Gathered ${chunks.length} chunk(s), ${payload.length} chars copied to clipboard:`
      );
      for (const chunk of chunks) {
        const size = chunk.content.length;
        const parts: string[] = [`${size} chars`];

        if (chunk.metadata?.cursorLine !== undefined) {
          parts.push(`cursor line ${chunk.metadata.cursorLine + 1}`);
        }
        if (chunk.metadata?.timestamp !== undefined) {
          parts.push(`edited ${formatAge(now - chunk.metadata.timestamp)}`);
        }

        const label = chunk.path ? ` ${chunk.path}` : "";
        output.appendLine(
          `  [${chunk.source}]${label} — ${parts.join(", ")}`
        );
      }
      output.show(true);

      vscode.window.showInformationMessage(
        `Distyl: copied ${chunks.length} chunk(s) (${payload.length} chars) to clipboard`
      );
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
