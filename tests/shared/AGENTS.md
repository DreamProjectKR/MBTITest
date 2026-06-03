# tests/shared/ — Test Harness (not tests)

- `worker-harness.mjs`: `createContext`, Cache API stubs (`installInMemoryCacheStub`, `installDefaultCacheStub`), D1 stubs (`createIndexDb`, `createDetailDb`, `createSaveDb`), R2 stub (`createJsonBucket`). `kv-harness.mjs`: KV stub.
- All workflow/API/infra tests must reuse these; don't duplicate ad-hoc stubs.
- `installInMemoryCacheStub` persists `put` so `match` returns it (key = `origin + pathname`); call `caches.default.delete(...)` to force the origin/304 path.
- No `*.test.mjs` here — helpers only.
