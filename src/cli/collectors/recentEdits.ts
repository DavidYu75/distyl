import * as fs from 'fs';
import * as path from 'path';
import type { Collector, ContextChunk } from '../../types';

const EDIT_WINDOW = 20; // ±20 lines around file midpoint
const RECENT_HOURS = 24;
const MAX_FILES = 5;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', '.vscode', '.idea', '__pycache__']);
const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib', '.node',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.mp3', '.mp4', '.avi', '.mov',
  '.db', '.sqlite', '.sqlite3',
]);
const SKIP_PATTERNS = ['.min.js', '.min.css', '.bundle.js'];

function shouldSkip(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTS.has(ext)) return true;
  const base = path.basename(filePath);
  return SKIP_PATTERNS.some((p) => base.endsWith(p));
}

interface FileEntry {
  filePath: string;
  mtime: number;
}

async function findRecentFiles(dir: string, cutoffMs: number): Promise<FileEntry[]> {
  const found: FileEntry[] = [];

  async function walk(current: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    await Promise.all(
      entries.map(async (entry) => {
        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name)) return;
          await walk(path.join(current, entry.name));
        } else if (entry.isFile()) {
          const full = path.join(current, entry.name);
          if (shouldSkip(full)) return;
          try {
            const stat = await fs.promises.stat(full);
            if (stat.mtimeMs >= cutoffMs) {
              found.push({ filePath: full, mtime: stat.mtimeMs });
            }
          } catch {
            // skip
          }
        }
      }),
    );
  }

  await walk(dir);
  return found;
}

export class CliRecentEditsCollector implements Collector {
  readonly name = 'cli-recent-edits';

  constructor(
    private readonly cwd: string,
    private readonly activeFilePath?: string,
  ) {}

  async collect(): Promise<ContextChunk[]> {
    const cutoff = Date.now() - RECENT_HOURS * 60 * 60 * 1000;
    const files = await findRecentFiles(this.cwd, cutoff);

    // Sort by mtime desc, skip the active file, take top MAX_FILES.
    const eligible = files
      .filter((f) => f.filePath !== this.activeFilePath)
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, MAX_FILES);

    const chunks: ContextChunk[] = [];

    for (const entry of eligible) {
      let content: string;
      try {
        content = await fs.promises.readFile(entry.filePath, 'utf8');
      } catch {
        continue;
      }

      const lines = content.split('\n');
      const midpoint = Math.floor(lines.length / 2);
      const startLine = Math.max(0, midpoint - EDIT_WINDOW);
      const endLine = Math.min(lines.length - 1, midpoint + EDIT_WINDOW);
      const window = lines.slice(startLine, endLine + 1).join('\n');
      const relPath = path.relative(this.cwd, entry.filePath);

      chunks.push({
        source: 'recent-edit',
        content: window,
        path: relPath,
        metadata: {
          timestamp: entry.mtime,
          lineRange: { start: startLine, end: endLine },
        },
      });
    }

    return chunks;
  }
}
