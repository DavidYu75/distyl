const esbuild = require("esbuild");

const production = process.argv.includes("--production");

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["bin/distyl.ts"],
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node20",
    outfile: "dist/cli.js",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    // vscode is never imported from CLI code; mark it external defensively.
    // @vscode/sqlite3 is Electron-specific — CLI doesn't use it.
    // @xenova/transformers is ESM-only; loaded via new Function() in miniLM.ts.
    // js-tiktoken is ESM-only; loaded via new Function() in tokenCounter.ts.
    external: ["vscode", "@vscode/sqlite3"],
    banner: {
      js: "#!/usr/bin/env node",
    },
    plugins: [
      {
        name: "native-node-modules",
        setup(build) {
          build.onResolve({ filter: /\.node$/ }, (args) => ({
            path: args.path,
            external: true,
          }));
        },
      },
    ],
    logLevel: "info",
  });

  await ctx.rebuild();
  await ctx.dispose();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
