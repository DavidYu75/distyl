// Mock for the 'vscode' module — used by Vitest unit tests running in plain Node.
// Only mocks the APIs the three Phase 1 collectors actually call.

export class Uri {
  static file(fsPath: string): Uri {
    return new Uri('file', fsPath);
  }

  static parse(value: string): Uri {
    const idx = value.indexOf('://');
    if (idx === -1) return new Uri('file', value);
    return new Uri(value.slice(0, idx), value.slice(idx + 3));
  }

  constructor(
    readonly scheme: string,
    readonly fsPath: string,
  ) {}

  toString(): string {
    return `${this.scheme}://${this.fsPath}`;
  }
}

export class Position {
  constructor(
    readonly line: number,
    readonly character: number,
  ) {}
}

export class Range {
  constructor(
    readonly start: Position,
    readonly end: Position,
  ) {}
}

export class Selection extends Range {
  readonly active: Position;
  readonly anchor: Position;
  readonly isEmpty: boolean;

  constructor(anchor: Position, active: Position) {
    super(anchor, active);
    this.anchor = anchor;
    this.active = active;
    this.isEmpty =
      anchor.line === active.line && anchor.character === active.character;
  }
}

export interface Disposable {
  dispose(): void;
}

// Mutable so tests can set activeTextEditor directly.
export const window: {
  activeTextEditor:
    | {
        document: {
          uri: Uri;
          getText(): string;
          languageId: string;
        };
        selection: Selection;
      }
    | undefined;
} = {
  activeTextEditor: undefined,
};

export interface ContentChange {
  range?: { start: { line: number; character: number } };
  text?: string;
}

export const workspace: {
  workspaceFolders: Array<{ uri: Uri }> | undefined;
  onDidChangeTextDocument(
    listener: (e: {
      document: { uri: Uri; getText(): string; languageId: string };
      contentChanges: ContentChange[];
    }) => void,
  ): Disposable;
  asRelativePath(uriOrString: Uri | string, includeWorkspaceFolder?: boolean): string;
} = {
  workspaceFolders: undefined,

  onDidChangeTextDocument(_listener) {
    return { dispose: () => {} };
  },

  asRelativePath(uriOrString, _includeWorkspaceFolder?) {
    if (typeof uriOrString === 'string') return uriOrString;
    return uriOrString.fsPath;
  },
};
