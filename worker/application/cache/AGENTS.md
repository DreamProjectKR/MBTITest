# worker/application/cache/ — Cache Invalidation & Index Snapshot

- `invalidateTestCaches`: on public detail/list change, delete KV `test:<id>` and `tests:index`, and purge the Cache API entries for `/api/tests` and `/api/tests/:id`.
- `refreshPublishedTestsIndexSnapshot`: best-effort R2 `assets/index.json` snapshot via `context.waitUntil` (Pages/API stay the source of truth; failures are swallowed).
- Called by workflows after a successful mutation. Keep idempotent; missing entries are not errors.

Verify: `npm test` (`tests/application/invalidate-cache-branches`, `refresh-index-snapshot`).
