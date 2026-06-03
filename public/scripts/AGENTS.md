# public/scripts/ — Page Entry Scripts

- Per-page scripts: `main.js`, `testlist.js`, `testintro.js`, `testquiz.js`, `testresult.js`; shared `layout.js`, `analytics.js`.
- Asset/config layer: `config.js` (loader) + `config-bootstrap.mjs` (`installMbtiConfig`, all URL helpers + `data-asset-*` hydration). Admin SPA modules live in `admin/` (own AGENTS.md).
- `config.js` stays dynamic `import()` only (no static top-level `import`) so it runs as a classic script when `type="module"` is missing (stale HTML / broken proxies).
- Use the installed globals (`assetUrl`, `assetResizeUrl`, `buildAssetUrl`, `prefetchImageAsset`, `loadImageAsset`); never hardcode asset URLs.
- `getTestIndex()` reads `/assets/index.json` first, then revalidates `/api/tests`; list pages listen for `mbti:test-index-updated`. The service worker registers once from `installMbtiConfig`.
- Preload/prefetch must use the SAME full URLs as the quiz, including `/cdn-cgi/image` width variants (raw vs resized = different cache keys).
- On `localhost`/`127.0.0.1`, `/cdn-cgi/image` is skipped; expect raw `/assets/*`. `strip-local-preloads.js` removes preloads that don't apply locally.

Verify: `tests/public/` + `tests/frontend/` (happy-dom); `npm run test:e2e`.
