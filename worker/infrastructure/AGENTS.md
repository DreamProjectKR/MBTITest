# worker/infrastructure/ — Storage I/O

The only place for storage access. Repositories take the binding as an argument; don't read globals or hold usecase logic.

## Layout

- `repositories/d1/` — `testMetadataRepository`, `testImageRepository` (system of record for metadata).
- `repositories/r2/` — `testBodyRepository` (`assets/<testId>/test.json`), `assetRepository` (image binaries).
- `repositories/kv/` — `testDetailCacheRepository` (`test:<id>` public detail cache).

## Contracts

- D1: parameterized `.bind(...)` only; never string-interpolate values. Avoid N+1; prefer batch or single queries.
- R2: canonical keys `assets/<testId>/test.json`, `assets/<testId>/images/...`. Be consistent stream vs buffer.
- KV: cache only; treat as disposable, never a source of truth. Public detail key is `test:<id>`.
- Keep repositories free of orchestration; sequencing and compensation belong in `application/`.

## Verify

- `npm test`; target `tests/infrastructure/*`.
- Tests note: `cache.put()` may run even when `waitUntil` is a no-op; to exercise the origin `If-None-Match`/304 path, delete the Cache API entry between requests (`tests/shared` harness).
