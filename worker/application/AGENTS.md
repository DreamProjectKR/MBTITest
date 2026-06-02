# worker/application/ — Orchestration (use cases)

Compose `domain/` (pure) with `infrastructure/` (I/O). No business rules, no request parsing here.

## Layout

- `queries/` — read models: `listPublishedTests`, `listAdminTests`, `getTestDetailBase`, `getPublicTestDetail`, `getAdminTestDetail`.
- `workflows/` — mutations: `saveTest`, `uploadTestImage`, `uploadResultImage`.
- `cache/` — `invalidateTestCaches`.

## Contracts

- Mutation order is a hard contract: validate → write body/assets (R2) → write metadata (D1) → invalidate caches → compensate on failure.
- Compensation lives here: e.g. `saveTestWorkflow` restores the previous R2 body (or deletes it when none existed) if the D1 upsert throws.
- Cache invalidation on public detail/list change: delete KV `test:<id>` and the Cache API entries for `/api/tests` and `/api/tests/:id`.
- Check `context.env` bindings at workflow entry; throw a clear `Error` if missing (the handler maps it to 500). Use a typed error (e.g. `SaveTestValidationError`) for 400-class validation failures.
- I/O (R2 / D1 / KV / Cache / `waitUntil`) lives here or in `infrastructure/`, never in `domain/`.

## Verify

- New workflow → success path + failure path tests using `tests/shared/worker-harness.mjs`. Don't copy ad-hoc D1/R2/KV stubs.
- `npm test`; target `tests/workflows/*`, `tests/application/*`.
