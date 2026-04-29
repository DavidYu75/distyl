import * as vscode from "vscode";
import { Collector, ContextChunk } from "../types";

const CURSOR_WINDOW = 40;

export class ActiveFileCollector implements Collector {
  readonly name = "active-file";

  async collect(): Promise<ContextChunk[]> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return [];

    const doc = editor.document;
    if (doc.uri.scheme !== "file") return [];

    const cursor = editor.selection.active;
    const path = vscode.workspace.asRelativePath(doc.uri, false) ?? doc.uri.fsPath;

    const lines = doc.getText().split("\n");
    const startLine = Math.max(0, cursor.line - CURSOR_WINDOW);
    const endLine = Math.min(lines.length - 1, cursor.line + CURSOR_WINDOW);
    const content = lines.slice(startLine, endLine + 1).join("\n");

    return [
      {
        source: "active-file",
        content,
        path,
        metadata: {
          cursorLine: cursor.line,
          cursorCharacter: cursor.character,
          language: doc.languageId,
          lineRange: { start: startLine, end: endLine },
        },
      },
    ];
  }
}
