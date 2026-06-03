# worker/infrastructure/repositories/kv/ — KV Repository

- `testDetailCacheRepository`: public detail cache at `test:<id>` (TTL ~300s).
- `testIndexCacheRepository`: published-list cache at `tests:index` (`{ etag, body: { tests } }`, TTL 300s).
- Cache only — disposable, never a source of truth. Tolerate misses; deletion on mutation is required for freshness.

Verify: `npm test` (`tests/infrastructure/test-detail-cache-repository`, `test-index-cache-repository`).
