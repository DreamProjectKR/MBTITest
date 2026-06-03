# worker/infrastructure/repositories/d1/ — D1 Repositories

- `testMetadataRepository` (tests metadata: upsert/list/detail), `testImageRepository` (`test_images` meta).
- Parameterized `.bind(...)` only — never interpolate values. Avoid N+1; prefer batch/single queries.
- D1 is the system of record for metadata; keep column mapping here, not in handlers.

Verify: `npm test` (`tests/infrastructure/d1-*`).
