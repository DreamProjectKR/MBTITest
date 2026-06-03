# worker/api/admin/utils/ — Admin D1/R2 Helpers

- `store.ts`: admin-side D1/R2 read/write helpers used by admin handlers/workflows.
- Prefer the layered repositories in `worker/infrastructure/repositories/` for new I/O; keep this thin and parameterized.
- Canonical asset keys only; reuse `domain/tests/assetKeys.ts`.

Verify: `npm test` (`tests/admin-*`).
