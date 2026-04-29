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
