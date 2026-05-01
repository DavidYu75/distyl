/**
 * Pre-publish script for the VS Code extension.
 *
 * Runs the production build and then replaces the real node_modules/sharp
 * with a lightweight stub.  @xenova/transformers does a top-level
 *   import sharp from 'sharp';
 * inside src/utils/image.js.  If the package is missing entirely, the
 * import throws and crashes the whole embedding pipeline.  Distyl only
 * uses text-embedding models (MiniLM) — never image processing — so a
 * no-op stub is sufficient.  This avoids shipping ~25 MB of native
 * libvips/sharp binaries in the VSIX.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. Run the production build.
execSync('node esbuild.js --production', { stdio: 'inherit' });

// 2. Replace node_modules/sharp with a tiny stub.
const sharpDir = path.join(__dirname, 'node_modules', 'sharp');
const sharpLibDir = path.join(sharpDir, 'lib');

// Back up the real sharp by renaming it (if not already stubbed).
const marker = path.join(sharpDir, '.distyl-stub');
if (!fs.existsSync(marker)) {
  // Wipe the real sharp contents and replace with the stub.
  const stubContent = `
'use strict';
// Stub: sharp is not needed by Distyl (text-embedding only).
function sharp() {
  throw new Error('sharp is not available — Distyl only uses text-embedding models.');
}
sharp.format = {};
sharp.versions = {};
module.exports = sharp;
module.exports.default = sharp;
`;

  const stubPkg = JSON.stringify({
    name: 'sharp',
    version: '0.0.0-stub',
    main: 'lib/index.js',
    description: 'Stub for @xenova/transformers image.js — Distyl does not use image processing.',
  }, null, 2) + '\n';

  // Wipe the entire sharp directory and recreate with just the stub.
  fs.rmSync(sharpDir, { recursive: true, force: true });
  fs.mkdirSync(sharpLibDir, { recursive: true });

  // Write stub files.
  fs.writeFileSync(path.join(sharpLibDir, 'index.js'), stubContent);
  fs.writeFileSync(path.join(sharpDir, 'package.json'), stubPkg);

  // Drop a marker so we don't re-stub on repeated runs.
  fs.writeFileSync(marker, 'stubbed by prepublish.js\n');
}

console.log('✓ sharp replaced with stub for VSIX packaging');
