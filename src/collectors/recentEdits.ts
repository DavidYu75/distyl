import * as vscode from "vscode";
import { Collector, ContextChunk } from "../types";

const EDIT_WINDOW = 20;

interface RecentEdit {
  uri: vscode.Uri;
  content: string;
  editLine: number;
  timestamp: number;
  language: string;
}

export class RecentEditsCollector implements Collector, vscode.Disposable {
  readonly name = "recent-edits";

  private readonly buffer = new Map<string, RecentEdit>();
  private readonly subscription: vscode.Disposable;

  constructor(private readonly maxFiles = 5) {
    this.subscription = vscode.workspace.onDidChangeTextDocument((e) =>
      this.onEdit(e)
    );
  }

  dispose(): void {
    this.subscription.dispose();
  }

  private onEdit(e: vscode.TextDocumentChangeEvent): void {
    const doc = e.document;
    if (doc.uri.scheme !== "file") return;
    if (e.contentChanges.length === 0) return;

    const editLine = e.contentChanges[0]?.range?.start?.line ?? 0;

    const key = doc.uri.toString();
    this.buffer.delete(key);
    this.buffer.set(key, {
      uri: doc.uri,
      content: doc.getText(),
      editLine,
      timestamp: Date.now(),
      language: doc.languageId,
    });

    while (this.buffer.size > this.maxFiles) {
      const oldestKey = this.buffer.keys().next().value;
      if (oldestKey === undefined) break;
      this.buffer.delete(oldestKey);
    }
  }

  async collect(): Promise<ContextChunk[]> {
    const activeKey = vscode.window.activeTextEditor?.document.uri.toString();

    return [...this.buffer.values()]
      .filter((e) => e.uri.toString() !== activeKey)
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((e) => {
        const lines = e.content.split("\n");
        const startLine = Math.max(0, e.editLine - EDIT_WINDOW);
        const endLine = Math.min(lines.length - 1, e.editLine + EDIT_WINDOW);
        return {
          source: "recent-edit" as const,
          content: lines.slice(startLine, endLine + 1).join("\n"),
          path: vscode.workspace.asRelativePath(e.uri, false),
          metadata: {
            timestamp: e.timestamp,
            language: e.language,
            lineRange: { start: startLine, end: endLine },
          },
        };
      });
  }
}
