import type { Uri } from 'vscode';
import type { ContextChunk } from '../../types';

export interface ScoredChunk extends ContextChunk {
  chunkId: string;
  score: number;
}

export interface BoostContext {
  activeFileUri?: Uri;
  now: number;
}

export interface Ranker {
  score(
    prompt: string,
    chunks: ContextChunk[],
    ctx: BoostContext,
  ): Promise<ScoredChunk[]>;
}
