import * as vscode from 'vscode';
import type { PipelineResult } from './pipeline';
import type { ScoredChunk } from './ranker/types';

const SOURCE_COLORS: Record<string, string> = {
  'active-file':  '#4a9eff',
  'recent-edit':  '#e6a817',
  'git-diff':     '#e88230',
  'git-log':      '#8a8a8a',
  'git-branch':   '#8a8a8a',
  'terminal':     '#a855f7',
};

function sourceColor(source: string): string {
  return SOURCE_COLORS[source] ?? '#8a8a8a';
}

export class PreviewPanel {
  private static _instance: PreviewPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private _result: PipelineResult;
  private _prompt: string;

  private constructor(result: PipelineResult, prompt: string) {
    this._result = result;
    this._prompt = prompt;

    this._panel = vscode.window.createWebviewPanel(
      'distylPreview',
      'Distyl Preview',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    this._panel.webview.onDidReceiveMessage((msg) => {
      if (msg.command === 'copyToClipboard') {
        const clipboardText = this._prompt.trim()
          ? this._prompt.trim() + '\n\n' + this._result.payload
          : this._result.payload;
        void vscode.env.clipboard.writeText(clipboardText);
      }
    });

    this._panel.onDidDispose(() => {
      PreviewPanel._instance = undefined;
    });

    this._update();
  }

  static show(result: PipelineResult, prompt: string): void {
    if (PreviewPanel._instance) {
      PreviewPanel._instance._result = result;
      PreviewPanel._instance._prompt = prompt;
      PreviewPanel._instance._panel.reveal(vscode.ViewColumn.Beside);
      PreviewPanel._instance._update();
    } else {
      PreviewPanel._instance = new PreviewPanel(result, prompt);
    }
  }

  dispose(): void {
    this._panel.dispose();
  }

  private _update(): void {
    this._panel.webview.html = buildHtml(this._result, this._prompt);
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function chunkCard(chunk: ScoredChunk, idx: number): string {
  const color = sourceColor(chunk.source);
  const path = chunk.path ?? '';
  const lineRange = chunk.metadata?.lineRange;
  const lineInfo = lineRange
    ? `lines ${lineRange.start + 1}–${lineRange.end + 1}`
    : '';
  const scoreStr = chunk.score > 0 ? `score ${chunk.score.toFixed(2)}` : '';

  const contentLines = chunk.content.split('\n');
  const preview = contentLines.slice(0, 10).join('\n');
  const rest = contentLines.slice(10).join('\n');
  const hasMore = contentLines.length > 10;

  const metaParts = [lineInfo, scoreStr].filter(Boolean);

  return `<div class="card">
  <div class="card-header">
    <span class="source-badge" style="color:${color}">${esc(chunk.source.toUpperCase())}</span>
    ${path ? `<span class="card-path">${esc(path)}</span>` : ''}
    <span class="card-meta">${metaParts.map(esc).join(' &nbsp; ')}</span>
  </div>
  <div class="code-wrap">${esc(preview)}</div>${hasMore ? `
  <div id="extra-${idx}" class="code-wrap" style="display:none;border-top:1px solid var(--border)">${esc(rest)}</div>
  <button class="expand-btn" data-expand="${idx}">Show more (${contentLines.length - 10} more lines)</button>` : ''}
</div>`;
}

function buildHtml(result: PipelineResult, prompt: string): string {
  const chunks = result.packedChunks;
  const promptDisplay = prompt.trim() || '(no prompt — raw dump)';
  const budgetLabel = result.tokenCount > 0
    ? `${result.tokenCount.toLocaleString()} tokens · ${result.budget}`
    : 'raw dump';

  const cards = chunks.length > 0
    ? chunks.map((c, i) => chunkCard(c, i)).join('\n')
    : '<p class="no-chunks">No chunks in payload.</p>';

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  :root {
    --bg: var(--vscode-editor-background, #1e1e1e);
    --fg: var(--vscode-editor-foreground, #d4d4d4);
    --border: var(--vscode-panel-border, #3a3a3a);
    --code-bg: var(--vscode-textCodeBlock-background, #2d2d2d);
    --btn-bg: var(--vscode-button-background, #0e639c);
    --btn-fg: var(--vscode-button-foreground, #ffffff);
    --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
    --secondary-fg: var(--vscode-descriptionForeground, #9e9e9e);
    --card-bg: var(--vscode-editorWidget-background, #252526);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
    font-size: var(--vscode-font-size, 13px);
    background: var(--bg);
    color: var(--fg);
    padding: 16px;
    line-height: 1.5;
  }
  .header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .header-meta { flex: 1; min-width: 0; }
  .prompt-text {
    font-weight: 600;
    font-size: 14px;
    word-break: break-word;
    margin-bottom: 4px;
  }
  .meta-row {
    color: var(--secondary-fg);
    font-size: 12px;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }
  button.copy-btn {
    background: var(--btn-bg);
    color: var(--btn-fg);
    border: none;
    padding: 6px 14px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  button.copy-btn:hover { background: var(--btn-hover); }
  .card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    margin-bottom: 10px;
    overflow: hidden;
  }
  .card-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    font-size: 12px;
    flex-wrap: wrap;
  }
  .source-badge {
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 0.04em;
    padding: 1px 6px;
    border-radius: 3px;
    background: rgba(0,0,0,0.25);
    flex-shrink: 0;
  }
  .card-path { color: var(--fg); font-size: 12px; word-break: break-all; }
  .card-meta { color: var(--secondary-fg); margin-left: auto; display: flex; gap: 12px; flex-shrink: 0; }
  .code-wrap {
    padding: 8px 12px;
    font-family: var(--vscode-editor-font-family, 'Courier New', monospace);
    font-size: var(--vscode-editor-font-size, 12px);
    background: var(--code-bg);
    overflow-x: auto;
    white-space: pre;
  }
  .expand-btn {
    background: none;
    border: none;
    color: var(--btn-bg);
    cursor: pointer;
    padding: 4px 12px;
    font-size: 12px;
    text-align: left;
    width: 100%;
    border-top: 1px solid var(--border);
  }
  .expand-btn:hover { text-decoration: underline; }
  .no-chunks { color: var(--secondary-fg); font-style: italic; padding: 16px 0; }
</style>
</head>
<body>
<div class="header">
  <div class="header-meta">
    <div class="prompt-text">${esc(promptDisplay)}</div>
    <div class="meta-row">
      <span>${result.chunksKept} chunk${result.chunksKept === 1 ? '' : 's'}</span>
      <span>${esc(budgetLabel)}</span>
      ${!result.ranked && prompt.trim() ? '<span style="color:#e88230">ranking offline</span>' : ''}
    </div>
  </div>
  <button class="copy-btn" onclick="copyToClipboard()">Copy to clipboard</button>
</div>

${cards}

<script>
  const vscode = acquireVsCodeApi();
  function copyToClipboard() {
    vscode.postMessage({ command: 'copyToClipboard' });
  }

  document.querySelectorAll('[data-expand]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-expand');
      const extra = document.getElementById('extra-' + id);
      if (!extra) return;
      const hidden = extra.style.display === 'none';
      extra.style.display = hidden ? 'block' : 'none';
      btn.textContent = hidden
        ? 'Show less'
        : btn.textContent.replace('Show less', btn.getAttribute('data-label') || 'Show more');
    });
  });
</script>
</body>
</html>`;
}
