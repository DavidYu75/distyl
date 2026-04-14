import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "distyl.gatherContext",
    async () => {
      vscode.window.showInformationMessage("Distyl: gather context (stub)");
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
