import { ContextChunk } from "./types";

export function formatChunks(chunks: ContextChunk[]): string {
  return chunks.map(formatChunk).join("\n\n");
}

function formatChunk(chunk: ContextChunk): string {
  const attrs: string[] = [`source="${chunk.source}"`];
  if (chunk.path) attrs.push(`path="${escapeAttr(chunk.path)}"`);
  if (chunk.metadata?.language) {
    attrs.push(`language="${chunk.metadata.language}"`);
  }
  return `<context ${attrs.join(" ")}>\n${chunk.content}\n</context>`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
