# tests/application/ — Application Layer Tests

- Covers queries + cache use cases: `getTestDetailBase` merge, `invalidateTestCaches` branches, `refresh-index-snapshot` (best-effort R2 `assets/index.json`).
- Stub infrastructure (D1/R2/KV/Cache) via shared harness; assert orchestration + invalidation calls (KV delete + Cache API delete), not storage internals.

Run: `npm test`.
