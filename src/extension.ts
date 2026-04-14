import * as vscode from "vscode";
import { ActiveFileCollector } from "./collectors/activeFile";
import { Collector } from "./types";

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("Distyl");
  context.subscriptions.push(output);

  const collectors: Collector[] = [new ActiveFileCollector()];

  const disposable = vscode.commands.registerCommand(
    "distyl.gatherContext",
    async () => {
      const results = await Promise.all(collectors.map((c) => c.collect()));
      const chunks = results.flat();

      output.clear();
      output.appendLine(`Gathered ${chunks.length} chunk(s):`);
      for (const chunk of chunks) {
        const size = chunk.content.length;
        const line = chunk.metadata?.cursorLine;
        output.appendLine(
          `  [${chunk.source}] ${chunk.path ?? "(no path)"} — ${size} chars` +
            (line !== undefined ? `, cursor line ${line + 1}` : "")
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
