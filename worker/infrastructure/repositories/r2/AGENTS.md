# worker/infrastructure/repositories/r2/ — R2 Repositories

- `testBodyRepository` (`assets/<testId>/test.json`: read/write/delete), `assetRepository` (image binaries + the best-effort `assets/index.json` list snapshot written via `putAsset`).
- Canonical keys only; reuse `domain/tests/assetKeys.ts`. Be consistent stream vs buffer.
- R2 is the system of record for body + image binaries; `assets/index.json` is a disposable snapshot, not the source of truth.

Verify: `npm test` (`tests/infrastructure/r2-*`, `tests/assets-proxy/`).
