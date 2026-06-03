# tests/api/ — HTTP API Handler Tests

- Covers handler behavior/branches/security for public + admin endpoints: list/load test detail (KV/cache/404/500), compute, admin images (security/put/branches), method handling, http-utils.
- Build requests via `createContext` (shared harness); assert status, JSON `{ error }`, and cache headers.
- `list-tests-kv` covers the KV `tests:index` read path and `If-None-Match`/304 for `GET /api/tests`.
- Security: SVG rejection, body limits, rate limit (fail-open without `MBTI_KV`).
- For the origin `If-None-Match`/304 path on load-test-detail, delete the Cache API entry before the 2nd request.

Run: `npm test`; target one file for fast branch coverage.
