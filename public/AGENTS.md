# public/ — Static Pages Site (no framework)

Plain HTML/CSS/JS served by Cloudflare Pages. Pages is static only; all dynamic behavior is the Worker (`/api/*`, `/assets/*`).

## Contracts

- `_routes.json` disables Pages Functions (`include: []`). Keep it — dynamic logic stays in `worker/`.
- Never hardcode asset URLs. Use the globals installed by `config-bootstrap.mjs` (`assetUrl`, `assetResizeUrl`, `buildAssetUrl`, `prefetchImageAsset`, `loadImageAsset`) via `data-asset-*` attributes; hydration is centralized there.
- `config.js` must stay dynamic `import()` only (no static top-level `import`) so it still runs as a classic script when `type="module"` is missing (stale HTML / broken proxies). Home images with only `data-asset-src` need `installMbtiConfig` to run.
- Image preload/prefetch must use the SAME full URLs as the quiz, including `/cdn-cgi/image` width variants (e.g. 360/480/720). Raw vs resized are different HTTP cache keys.
- On `localhost` / `127.0.0.1`, `/cdn-cgi/image` is skipped (not in `wrangler pages dev`); expect raw `/assets/*` locally.

## Layout

- Page scripts: `scripts/main.js`, `testlist.js`, `testintro.js`, `testquiz.js`, `testresult.js`, `layout.js`, `analytics.js`.
- Admin SPA: `scripts/admin/` (see its own `AGENTS.md`).
- `styles/` CSS, `partials/` shared HTML, `sw.js` service worker.

## Verify

- Browser scripts via happy-dom under `tests/public/` (+ `tests/frontend/`); flows via `npm run test:e2e`.
- Local: `npm run pages:dev` (static) or `npm run dev` (Worker serves `public/` via the `ASSETS` binding).
