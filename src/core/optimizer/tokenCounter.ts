import type { ContextChunk } from '../../types';

type TiktokenEncoding = { encode(text: string): Uint32Array };
type TiktokenModule = { getEncoding(name: string): TiktokenEncoding };

// Singleton — loaded once on first countTokens call.
let encPromise: Promise<TiktokenEncoding> | undefined;

async function getEncoding(): Promise<TiktokenEncoding> {
  if (!encPromise) {
    encPromise = (async () => {
      // In the Vitest environment import() works natively (vite-node runner).
      // In esbuild/CJS bundles we use new Function() to prevent esbuild from
      // converting the dynamic import to require() for this ESM-only package.
      let mod: TiktokenModule;
      if (process.env['VITEST']) {
        // @ts-expect-error — ESM import in vite-node context
        mod = await import('js-tiktoken');
      } else {
        mod = await (new Function('return import("js-tiktoken")')() as Promise<TiktokenModule>);
      }
      return mod.getEncoding('cl100k_base');
    })();
  }
  return encPromise;
}

export async function countTokens(text: string): Promise<number> {
  const enc = await getEncoding();
  return enc.encode(text).length;
}

/**
 * Counts tokens for a chunk as it will appear in the formatted output:
 * the XML wrapper attributes + content together.
 */
export async function countChunkTokens(chunk: ContextChunk): Promise<number> {
  const attrs = [`source="${chunk.source}"`];
  if (chunk.path) attrs.push(`path="${chunk.path}"`);
  const header = `<context ${attrs.join(' ')}>\n`;
  const footer = `\n</context>`;
  return countTokens(header + chunk.content + footer);
}
