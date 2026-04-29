import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscodeMock from 'vscode';

// Must be hoisted so the vi.mock factory can reference it before any imports.
const mockExecFile = vi.hoisted(() =>
  vi.fn<[string, string[], object], Promise<{ stdout: string; stderr: string }>>(),
);

vi.mock('child_process', () => {
  // Set the promisify.custom symbol so util.promisify(execFile) returns mockExecFile
  // directly (resolving to { stdout, stderr } as the real execFile does).
  const kCustom = Symbol.for('nodejs.util.promisify.custom');
  const execFile: any = () => {};
  execFile[kCustom] = mockExecFile;
  return { execFile };
});

import { GitCollector } from '../../src/collectors/git';

beforeEach(() => {
  vscodeMock.workspace.workspaceFolders = undefined;
  mockExecFile.mockReset();
});

describe('GitCollector', () => {
  it('returns [] when no workspace folder is configured', async () => {
    const collector = new GitCollector();
    expect(await collector.collect()).toEqual([]);
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('returns [] when git reports the directory is not a repo', async () => {
    vscodeMock.workspace.workspaceFolders = [{ uri: vscodeMock.Uri.file('/workspace') }];
    mockExecFile.mockResolvedValueOnce({ stdout: 'false\n', stderr: '' });

    const collector = new GitCollector();
    expect(await collector.collect()).toEqual([]);
  });

  it('returns [] when git rev-parse throws (git not installed or not a repo)', async () => {
    vscodeMock.workspace.workspaceFolders = [{ uri: vscodeMock.Uri.file('/workspace') }];
    mockExecFile.mockRejectedValueOnce(new Error('git: command not found'));

    const collector = new GitCollector();
    expect(await collector.collect()).toEqual([]);
  });

  it('returns other chunks when one subprocess fails (per-subprocess try/catch)', async () => {
    vscodeMock.workspace.workspaceFolders = [{ uri: vscodeMock.Uri.file('/workspace') }];
    mockExecFile
      .mockResolvedValueOnce({ stdout: 'true\n', stderr: '' })           // isGitRepo
      .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })           // branch
      .mockRejectedValueOnce(new Error('ambiguous argument HEAD'))       // diff — fails
      .mockResolvedValueOnce({ stdout: 'abc123 a commit\n', stderr: '' }); // log

    const collector = new GitCollector();
    const chunks = await collector.collect();
    const sources = chunks.map((c) => c.source);

    expect(sources).toContain('git-branch');
    expect(sources).toContain('git-log');
    expect(sources).not.toContain('git-diff');
  });

  it('emits no git-diff chunk when diff output is empty', async () => {
    vscodeMock.workspace.workspaceFolders = [{ uri: vscodeMock.Uri.file('/workspace') }];
    mockExecFile
      .mockResolvedValueOnce({ stdout: 'true\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })  // empty diff
      .mockResolvedValueOnce({ stdout: 'abc commit\n', stderr: '' });

    const collector = new GitCollector();
    const chunks = await collector.collect();
    expect(chunks.map((c) => c.source)).not.toContain('git-diff');
  });

  it('splits a multi-hunk diff into one chunk per hunk', async () => {
    const multiHunkDiff = [
      'diff --git a/src/auth.ts b/src/auth.ts',
      '--- a/src/auth.ts',
      '+++ b/src/auth.ts',
      '@@ -1,3 +1,4 @@',
      ' line1',
      '+added1',
      ' line2',
      '@@ -10,3 +11,4 @@',
      ' line10',
      '+added2',
      ' line11',
    ].join('\n');

    vscodeMock.workspace.workspaceFolders = [{ uri: vscodeMock.Uri.file('/workspace') }];
    mockExecFile
      .mockResolvedValueOnce({ stdout: 'true\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: multiHunkDiff, stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    const collector = new GitCollector();
    const chunks = await collector.collect();
    const diffChunks = chunks.filter((c) => c.source === 'git-diff');
    expect(diffChunks).toHaveLength(2);
    expect(diffChunks[0].path).toBe('src/auth.ts');
    expect(diffChunks[0].content).toContain('@@ -1,3');
    expect(diffChunks[1].content).toContain('@@ -10,3');
  });

  it('truncates a hunk exceeding 200 lines with a marker', async () => {
    // Build a hunk with 210 lines
    const bigLines = ['diff --git a/big.ts b/big.ts', '--- a/big.ts', '+++ b/big.ts', '@@ -1,210 +1,210 @@'];
    for (let i = 0; i < 210; i++) bigLines.push(`+line ${i}`);
    const bigDiff = bigLines.join('\n');

    vscodeMock.workspace.workspaceFolders = [{ uri: vscodeMock.Uri.file('/workspace') }];
    mockExecFile
      .mockResolvedValueOnce({ stdout: 'true\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: bigDiff, stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    const collector = new GitCollector();
    const chunks = await collector.collect();
    const diffChunks = chunks.filter((c) => c.source === 'git-diff');
    expect(diffChunks).toHaveLength(1);
    expect(diffChunks[0].content).toContain('[truncated');
  });

  it('returns all three chunk types when all subprocesses succeed', async () => {
    vscodeMock.workspace.workspaceFolders = [{ uri: vscodeMock.Uri.file('/workspace') }];
    mockExecFile
      .mockResolvedValueOnce({ stdout: 'true\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: '+line1\n+line2\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'abc123 initial commit\n', stderr: '' });

    const collector = new GitCollector();
    const chunks = await collector.collect();
    const sources = chunks.map((c) => c.source);

    expect(sources).toContain('git-branch');
    expect(sources).toContain('git-diff');
    expect(sources).toContain('git-log');
  });
});
