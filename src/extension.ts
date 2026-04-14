import * as vscode from "vscode";
import { ActiveFileCollector } from "./collectors/activeFile";
import { RecentEditsCollector } from "./collectors/recentEdits";
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
  ];

  const disposable = vscode.commands.registerCommand(
    "distyl.gatherContext",
    async () => {
      const results = await Promise.all(collectors.map((c) => c.collect()));
      const chunks = results.flat();
      const now = Date.now();

      output.clear();
      output.appendLine(`Gathered ${chunks.length} chunk(s):`);
      for (const chunk of chunks) {
        const size = chunk.content.length;
        const parts: string[] = [`${size} chars`];

        if (chunk.metadata?.cursorLine !== undefined) {
          parts.push(`cursor line ${chunk.metadata.cursorLine + 1}`);
        }
        if (chunk.metadata?.timestamp !== undefined) {
          parts.push(`edited ${formatAge(now - chunk.metadata.timestamp)}`);
        }

        output.appendLine(
          `  [${chunk.source}] ${chunk.path ?? "(no path)"} — ${parts.join(", ")}`
        );
      }
      output.show(true);

      vscode.window.showInformationMessage(
        `Distyl: gathered ${chunks.length} chunk(s)`
      );
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
