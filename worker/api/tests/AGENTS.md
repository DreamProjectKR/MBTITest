# worker/api/tests/ — Public Test Endpoints

- `index.ts`: `GET /api/tests` → published only. Read order KV `tests:index` → Cache API → D1 (`listPublishedTests`); supports `If-None-Match`/304 and writes back KV + Cache API on miss via `waitUntil` (Cache-Tag `api,api-tests`).
- `[id].ts`: `GET /api/tests/:id` → KV → D1 + R2 merge; draft → `404`.
- Thin handlers: delegate to queries and set cache headers; never assemble D1/R2/KV here.

Verify: `npm test` (`tests/api/`, `tests/public-browse/`).
