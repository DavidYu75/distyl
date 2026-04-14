import * as vscode from "vscode";
import { Collector, ContextChunk } from "../types";

export class ActiveFileCollector implements Collector {
  readonly name = "active-file";

  async collect(): Promise<ContextChunk[]> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return [];
    }

    const doc = editor.document;
    if (doc.uri.scheme !== "file") {
      return [];
    }

    const cursor = editor.selection.active;
    const path =
      vscode.workspace.asRelativePath(doc.uri, false) ?? doc.uri.fsPath;

    const chunk: ContextChunk = {
      source: "active-file",
      content: doc.getText(),
      path,
      metadata: {
        cursorLine: cursor.line,
        cursorCharacter: cursor.character,
        language: doc.languageId,
      },
    };

    return [chunk];
  }
}
