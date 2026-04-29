import { describe, it, expect, beforeEach } from 'vitest';
import * as vscodeMock from 'vscode';
import { ActiveFileCollector } from '../../src/collectors/activeFile';

const collector = new ActiveFileCollector();

beforeEach(() => {
  vscodeMock.window.activeTextEditor = undefined;
});

describe('ActiveFileCollector', () => {
  it('returns [] when no editor is open', async () => {
    expect(await collector.collect()).toEqual([]);
  });

  it('returns [] when active document scheme is not "file"', async () => {
    vscodeMock.window.activeTextEditor = {
      document: {
        uri: new vscodeMock.Uri('untitled', 'Untitled-1'),
        getText: () => 'hello',
        languageId: 'plaintext',
      },
      selection: new vscodeMock.Selection(
        new vscodeMock.Position(0, 0),
        new vscodeMock.Position(0, 0),
      ),
    };
    expect(await collector.collect()).toEqual([]);
  });

  it('returns a chunk with correct content, path, and cursor metadata', async () => {
    const uri = vscodeMock.Uri.file('/workspace/src/foo.ts');
    vscodeMock.window.activeTextEditor = {
      document: { uri, getText: () => 'const x = 1;', languageId: 'typescript' },
      selection: new vscodeMock.Selection(
        new vscodeMock.Position(3, 5),
        new vscodeMock.Position(3, 5),
      ),
    };
    const chunks = await collector.collect();
    expect(chunks).toHaveLength(1);
    expect(chunks[0].source).toBe('active-file');
    expect(chunks[0].content).toBe('const x = 1;');
    expect(chunks[0].path).toBe('/workspace/src/foo.ts');
    expect(chunks[0].metadata?.cursorLine).toBe(3);
    expect(chunks[0].metadata?.cursorCharacter).toBe(5);
    expect(chunks[0].metadata?.language).toBe('typescript');
  });
});
