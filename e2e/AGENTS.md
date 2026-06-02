# e2e/ — Playwright E2E

Browser end-to-end tests against a local Worker. Config: `e2e/playwright.config.mjs`.

## Run

- `npm run test:e2e` runs all `e2e/*.spec.mjs`.
- `webServer` auto-starts `npx wrangler dev --config worker/wrangler.toml --port 8788`; `baseURL` is `http://127.0.0.1:8788`.
- `reuseExistingServer` is on locally (off in CI). If port `8788` already runs the Worker, Playwright reuses it instead of starting a new one.
- `workers: 1`, `fullyParallel: false` — keep specs order-independent and self-contained; don't assume shared cross-spec state.

## Contracts

- Specs match `**/*.spec.mjs` only (not `*.test.mjs`, which are `node:test` files).
- E2E exercises real Worker routing + `public/` assets; use it for flows that unit tests can't cover (asset hydration, `/cdn-cgi/image`, full quiz/result flow).
- Production verification is separate (`npm run verify:dreamp`) and only valid AFTER a deploy.

## Verify

- `npm run test:e2e`. On failure, inspect the Playwright trace (`trace: "on-first-retry"`).
