import type { ContextChunk } from '../../types';

export interface ScoredChunk extends ContextChunk {
  chunkId: string;
  score: number;
}

export interface BoostContext {
  activeFileUri?: string; // absolute fsPath of the active file
  now: number;
}

export interface Ranker {
  score(
    prompt: string,
    chunks: ContextChunk[],
    ctx: BoostContext,
  ): Promise<ScoredChunk[]>;
}
