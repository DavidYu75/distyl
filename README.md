# Distyl

A VS Code extension that distils noisy workspace context into clear, relevant payloads for AI chat.

Instead of copy-pasting files, diffs, and terminal output into an AI assistant, Distyl monitors your active workspace, scores context against your prompt using local semantic similarity, packs the most relevant material within a configurable token budget, and delivers a formatted payload ready for any AI model.

## Pipeline

Four stages, each a self-contained module:

1. **Gather** — collectors pull context from the active file, recent edits, git state, and terminal.
2. **Rank** — chunks are scored against your prompt via local embeddings (`all-MiniLM-L6-v2`), boosted by recency and file proximity.
3. **Optimize** — greedy packing fits the highest-scoring chunks into a token budget (Focused 4k / Standard 8k / Deep 16k), with paragraph-level compression for oversized chunks.
4. **Deliver** — formatted markdown with XML-style section tags, copied to clipboard or shown in a preview panel.

## Development

```bash
npm install
npm run compile     # one-shot build
npm run watch       # rebuild on change
npm run check-types # tsc --noEmit
```

Press **F5** in VS Code to launch the Extension Development Host, then run **Distyl: Gather Context** from the command palette.

## Tech stack

| Component | Choice |
|---|---|
| Language | TypeScript |
| Bundler | esbuild |
| Embeddings | `all-MiniLM-L6-v2` via transformers.js |
| Token counting | tiktoken |
| Cache | better-sqlite3 |
