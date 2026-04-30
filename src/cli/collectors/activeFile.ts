import * as fs from 'fs';
import * as path from 'path';
import type { Collector, ContextChunk } from '../../types';

const CURSOR_WINDOW = 40; // ±40 lines around the midpoint (no cursor in CLI)
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

async function findMostRecentFile(dir: string): Promise<{ filePath: string; mtime: number } | null> {
  let best: { filePath: string; mtime: number } | null = null;

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
            const mtime = stat.mtimeMs;
            if (!best || mtime > best.mtime) {
              best = { filePath: full, mtime };
            }
          } catch {
            // skip unreadable files
          }
        }
      }),
    );
  }

  await walk(dir);
  return best;
}

export class CliActiveFileCollector implements Collector {
  readonly name = 'cli-active-file';

  constructor(private readonly cwd: string) {}

  async collect(): Promise<ContextChunk[]> {
    const found = await findMostRecentFile(this.cwd);
    if (!found) return [];

    let content: string;
    try {
      content = await fs.promises.readFile(found.filePath, 'utf8');
    } catch {
      return [];
    }

    const lines = content.split('\n');
    const midpoint = Math.floor(lines.length / 2);
    const startLine = Math.max(0, midpoint - CURSOR_WINDOW);
    const endLine = Math.min(lines.length - 1, midpoint + CURSOR_WINDOW);
    const window = lines.slice(startLine, endLine + 1).join('\n');
    const relPath = path.relative(this.cwd, found.filePath);

    return [
      {
        source: 'active-file',
        content: window,
        path: relPath,
        metadata: {
          timestamp: found.mtime,
          lineRange: { start: startLine, end: endLine },
        },
      },
    ];
  }
}
