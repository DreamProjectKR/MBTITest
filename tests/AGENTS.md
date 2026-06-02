# tests/ — Automated Tests

`node:test` runner + happy-dom for browser scripts. Playwright E2E lives in `e2e/`. See `docs/TEST_STRATEGY.md`.

## Run

- `npm test` — full `node:test` run (`node --test --experimental-strip-types`).
- `npm run test:coverage` — coverage; includes `worker/**/*.ts` + `public/scripts/**/*.{js,mjs}`. V8 report prints to the terminal.
- `npm run test:e2e` — Playwright (separate). There is no `test:all` script.
- Files: `tests/<domain>/*.test.mjs`. Browser scripts use `tests/public/setup-happy-dom.mjs`.

## Contracts

- Layers: domain, workflow, routing, asset-proxy, frontend-admin, security/http-utils.
- Group tests by feature, not by file. Minimum per workflow: 1 success path + 1 failure path.
- Use `tests/shared/worker-harness.mjs` + `kv-harness.mjs` for D1/R2/KV/Cache stubs. Don't copy ad-hoc stubs into new workflow tests.
- Origin `If-None-Match`/304 path on `loadTestDetail`: `cache.put()` may still run under a no-op `waitUntil`; clear the Cache API entry (`caches.default.delete(cacheKeyForGet(url))`) before the second request.
- Coverage policy: aim for meaningful nearest tests; repo-wide 100% is NOT the goal. Never weaken config / ignore / skip / delete to fake coverage. `public/` statics and some branches are covered via E2E / manual.

## Working Rules

- When a test fails, fix Worker / `public/` code first; change the test only if production behavior is already the intended contract.
- Don't add duplicate / always-pass / unnecessary tests; flag any found for merge or fix.
- After large or high-coverage test work, run a reviewer pass so assertions track real business rules, not mock behavior.
