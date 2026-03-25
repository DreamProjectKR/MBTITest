import { defineConfig } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.mjs",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8788",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx wrangler dev --config worker/wrangler.toml --port 8788",
    cwd: repoRoot,
    url: "http://127.0.0.1:8788/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
