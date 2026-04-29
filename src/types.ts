export type ChunkSource =
  | "active-file"
  | "recent-edit"
  | "git-diff"
  | "git-log"
  | "git-branch"
  | "terminal";

export interface ChunkMetadata {
  cursorLine?: number;
  cursorCharacter?: number;
  timestamp?: number;
  language?: string;
  lineRange?: { start: number; end: number };
}

export interface ContextChunk {
  source: ChunkSource;
  content: string;
  path?: string;
  metadata?: ChunkMetadata;
}

export interface Collector {
  readonly name: string;
  collect(): Promise<ContextChunk[]>;
}
