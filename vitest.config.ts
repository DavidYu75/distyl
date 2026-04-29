import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      vscode: resolve(__dirname, 'test/__mocks__/vscode.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    passWithNoTests: true,
    // MiniLMRanker golden tests inject the embed function via
    // setEmbedFnForTesting() so they never call new Function(...) at all.
    // No special pool needed.
  },
});
