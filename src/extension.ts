import * as vscode from 'vscode';
import { ActiveFileCollector } from './collectors/activeFile';
import { GitCollector } from './collectors/git';
import { RecentEditsCollector } from './collectors/recentEdits';
import { SqliteEmbeddingCache } from './core/cache/sqlite';
import { runPipeline } from './core/pipeline';
import type { BudgetPreset } from './core/pipeline';
import { MiniLMRanker, preloadMiniLM } from './core/ranker/miniLM';
import { renderTrace, writeTrace } from './core/trace';
import type { BoostContext } from './core/ranker/types';
import type { Collector } from './types';

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('Distyl');
  context.subscriptions.push(output);

  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  context.subscriptions.push(statusBar);

  // Cache and ranker — both fail gracefully if the environment is broken.
  const cache = new SqliteEmbeddingCache(output);
  const ranker = new MiniLMRanker(cache);

  // Kick off background model preload so the first command is fast.
  preloadMiniLM();

  const recentEdits = new RecentEditsCollector();
  context.subscriptions.push(recentEdits);

  const collectors: Collector[] = [
    new ActiveFileCollector(),
    recentEdits,
    new GitCollector(),
  ];

  const disposable = vscode.commands.registerCommand(
    'distyl.gatherContext',
    async () => {
      const start = Date.now();
      const editor = vscode.window.activeTextEditor;

      // Pre-populate input box with selected text if non-empty.
      const selectionText =
        editor && !editor.selection.isEmpty
          ? editor.document.getText(editor.selection)
          : undefined;

      const prompt = await vscode.window.showInputBox({
        prompt: 'Distyl: what are you asking the AI?',
        value: selectionText ?? '',
        placeHolder: 'e.g. fix the auth bug',
      });

      // undefined → user pressed Esc
      const promptText = prompt ?? '';

      const boostCtx: BoostContext = {
        activeFileUri: editor?.document.uri.fsPath,
        now: Date.now(),
      };

      const config = vscode.workspace.getConfiguration('distyl');
      const budget = (config.get<string>('budget') ?? 'standard') as BudgetPreset;

      const result = await runPipeline(promptText, {
        collectors,
        ranker,
        boostCtx,
        budget,
        outputChannel: output,
      });

      await vscode.env.clipboard.writeText(result.payload);

      // Show ranker-offline status bar when a prompt was given but ranking failed.
      if (!result.ranked && promptText) {
        statusBar.text = '$(warning) Distyl: ranker offline';
        statusBar.tooltip = 'MiniLM failed to load — raw dump delivered. Check the Distyl output channel.';
        statusBar.show();
      } else {
        statusBar.hide();
      }

      // Render per-chunk trace to OutputChannel and append to log.jsonl.
      const elapsed = Date.now() - start;
      const kept = result.trace.filter((c) => c.kept);

      output.appendLine(
        `[distyl] ${result.chunksIn} chunks in → ${result.chunksKept} kept → ${result.tokenCount} tokens (${budget})`,
      );

      renderTrace(result.trace, promptText, elapsed, output);
      writeTrace(
        {
          ts: start,
          prompt: promptText,
          chunks_in: result.chunksIn,
          chunks_kept: kept.length,
          chunks_dropped: result.chunksIn - kept.length,
          top_scores: kept.slice(0, 5).map((c) => c.score),
          elapsed_ms: elapsed,
        },
        output,
      );

      // Toast the user if cache writes have been consistently failing.
      if (cache.sessionSetFailures >= 3) {
        vscode.window.showWarningMessage(
          `Distyl: embedding cache has failed ${cache.sessionSetFailures} times this session. ` +
            'Check ~/.distyl/ permissions.',
        );
      }

      output.show(true);
    },
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
