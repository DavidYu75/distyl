import * as vscode from 'vscode';
import type { Collector, ContextChunk } from '../types';
import { collectGit } from './gitImpl';

export class GitCollector implements Collector {
  readonly name = 'git';

  async collect(): Promise<ContextChunk[]> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) return [];
    return collectGit(cwd);
  }
}
