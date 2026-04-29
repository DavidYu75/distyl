const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/extension.js",
    // vscode is provided by the extension host.
    // @vscode/sqlite3 contains a prebuilt .node binary — cannot be bundled.
    // @xenova/transformers is ESM-only; loaded via new Function('return import(...)')()
    // in miniLM.ts so esbuild never sees it as a static dependency.
    // The .node plugin below catches any other native binaries defensively.
    external: ["vscode", "@vscode/sqlite3"],
    plugins: [
      {
        name: "native-node-modules",
        setup(build) {
          // Mark any .node binary as external so esbuild doesn't try to bundle it.
          build.onResolve({ filter: /\.node$/ }, (args) => ({
            path: args.path,
            external: true,
          }));
        },
      },
    ],
    logLevel: "info",
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
