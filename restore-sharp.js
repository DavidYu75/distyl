/**
 * Restore the real sharp package after prepublish.js replaced it with a stub.
 * Run this after `vsce package` / `vsce publish` to get back to a working dev state.
 *
 * Usage:  node restore-sharp.js
 *         — or just run `npm install` which reinstalls everything.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const marker = path.join(__dirname, 'node_modules', 'sharp', '.distyl-stub');
if (fs.existsSync(marker)) {
  console.log('Restoring real sharp via npm install...');
  execSync('npm install sharp', { stdio: 'inherit', cwd: __dirname });
  console.log('✓ sharp restored');
} else {
  console.log('sharp is not stubbed — nothing to restore.');
}
