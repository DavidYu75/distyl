import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscodeMock from 'vscode';
import { RecentEditsCollector } from '../../src/collectors/recentEdits';

type EditListener = Parameters<typeof vscodeMock.workspace.onDidChangeTextDocument>[0];

function makeDoc(fsPath: string, content = 'content') {
  return {
    uri: vscodeMock.Uri.file(fsPath),
    getText: () => content,
    languageId: 'typescript',
  };
}

let fireEdit: EditListener;

beforeEach(() => {
  vscodeMock.window.activeTextEditor = undefined;
  vi.spyOn(vscodeMock.workspace, 'onDidChangeTextDocument').mockImplementation((listener) => {
    fireEdit = listener;
    return { dispose: vi.fn() };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RecentEditsCollector', () => {
  it('LRU cap: buffer never exceeds 5 entries', async () => {
    const collector = new RecentEditsCollector();
    for (let i = 0; i < 7; i++) {
      fireEdit({ document: makeDoc(`/workspace/file${i}.ts`), contentChanges: [{}] });
    }
    const chunks = await collector.collect();
    expect(chunks).toHaveLength(5);
    collector.dispose();
  });

  it('filters out the active editor URI from collect() results', async () => {
    const collector = new RecentEditsCollector();
    const activeDoc = makeDoc('/workspace/active.ts', 'active');
    const otherDoc = makeDoc('/workspace/other.ts', 'other');

    fireEdit({ document: activeDoc, contentChanges: [{}] });
    fireEdit({ document: otherDoc, contentChanges: [{}] });

    vscodeMock.window.activeTextEditor = {
      document: activeDoc,
      selection: new vscodeMock.Selection(
        new vscodeMock.Position(0, 0),
        new vscodeMock.Position(0, 0),
      ),
    };

    const chunks = await collector.collect();
    const paths = chunks.map((c) => c.path);
    expect(paths).not.toContain('/workspace/active.ts');
    expect(paths).toContain('/workspace/other.ts');
    collector.dispose();
  });

  it('returns results sorted newest-first', async () => {
    let t = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => t++);

    const collector = new RecentEditsCollector();
    for (const name of ['file0', 'file1', 'file2']) {
      fireEdit({ document: makeDoc(`/workspace/${name}.ts`), contentChanges: [{}] });
    }

    const chunks = await collector.collect();
    // Timestamps: file0=1000, file1=1001, file2=1002 → newest-first
    expect(chunks[0].path).toBe('/workspace/file2.ts');
    expect(chunks[2].path).toBe('/workspace/file0.ts');
    collector.dispose();
  });

  it('ignores events with no content changes', async () => {
    const collector = new RecentEditsCollector();
    fireEdit({ document: makeDoc('/workspace/file.ts'), contentChanges: [] });
    const chunks = await collector.collect();
    expect(chunks).toHaveLength(0);
    collector.dispose();
  });

  it('ignores non-file scheme URIs', async () => {
    const collector = new RecentEditsCollector();
    fireEdit({
      document: {
        uri: new vscodeMock.Uri('git', '/workspace/file.ts'),
        getText: () => 'content',
        languageId: 'typescript',
      },
      contentChanges: [{}],
    });
    const chunks = await collector.collect();
    expect(chunks).toHaveLength(0);
    collector.dispose();
  });
});
