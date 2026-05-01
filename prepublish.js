/**
 * Pre-publish script for the VS Code extension.
 *
 * Runs the production build and then patches @xenova/transformers so it
 * doesn't crash when 'sharp' is missing from the VSIX.
 *
 * The problem: image.js has `import sharp from 'sharp'` — a static ESM
 * import that throws at module-link time if sharp isn't installed.  Distyl
 * excludes sharp from the VSIX (~25 MB savings) because it only uses text
 * embeddings, never image processing.
 *
 * The fix: rewrite that one import as a dynamic try/catch and remove the
 * hard throw in the else branch so the module loads cleanly without sharp.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. Run the production build.
execSync('node esbuild.js --production', { stdio: 'inherit' });

// 2. Patch @xenova/transformers/src/utils/image.js.
const imageJs = path.join(
  __dirname,
  'node_modules',
  '@xenova',
  'transformers',
  'src',
  'utils',
  'image.js',
);

let src = fs.readFileSync(imageJs, 'utf8');

// Replace the static import with a dynamic try/catch.
// Original:  import sharp from 'sharp';
// Patched:   let sharp; try { sharp = (await import('sharp')).default; } catch {}
const staticImport = "import sharp from 'sharp';";
const dynamicImport =
  "let sharp; try { sharp = (await import('sharp')).default; } catch { /* sharp unavailable — image processing disabled */ }";

if (!src.includes(staticImport)) {
  // Already patched or import changed upstream — check for our patch.
  if (src.includes('try { sharp =')) {
    console.log('  image.js already patched (skipping)');
  } else {
    console.error(
      'ERROR: Could not find sharp import in image.js — @xenova/transformers may have changed.',
    );
    process.exit(1);
  }
} else {
  src = src.replace(staticImport, dynamicImport);

  // Also soften the else-throw so the module loads without sharp.
  // Original:  throw new Error('Unable to load image processing library.');
  // Patched:   (no-op — image processing simply won't be available)
  src = src.replace(
    "throw new Error('Unable to load image processing library.');",
    "// sharp not available — image processing disabled (patched by Distyl prepublish.js)",
  );

  fs.writeFileSync(imageJs, src);
  console.log('✓ @xenova/transformers patched (sharp import made optional)');
}
