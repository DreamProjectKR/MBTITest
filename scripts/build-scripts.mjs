import { build, context } from "esbuild";

/**
 * Bundles TS browser entrypoints (src/scripts/*.ts) into public/scripts/*.js.
 *
 * We keep output paths stable so existing HTML keeps working:
 * - src/scripts/testlist.ts -> public/scripts/testlist.js
 */

const entryPoints = [
  "src/scripts/main.ts",
  "src/scripts/testlist.ts",
  "src/scripts/testintro.ts",
  "src/scripts/testquiz.ts",
  "src/scripts/testresult.ts",
  "src/scripts/admin.ts",
];

const buildOptions = {
  entryPoints,
  outdir: "public/scripts",
  entryNames: "[name]",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  sourcemap: true,
  logLevel: "info",
};

const isWatch = process.argv.includes("--watch");
if (isWatch) {
  const ctx = await context(buildOptions);
  await ctx.watch();
  // Keep process alive.
  await new Promise(() => {});
} else {
  await build(buildOptions);
}


