# tests/admin-authoring/ — Admin Save Workflow Tests

- Covers `saveTestWorkflow`: validation, R2 body write, D1 metadata upsert, cache invalidation, and compensation on failure (`save-test`, `save-test-compensation`).
- Use `tests/shared/worker-harness.mjs` (`createSaveDb`, `createJsonBucket`); assert the mutation order and rollback (previous body restore/delete when D1 upsert throws).
- Minimum: 1 success + 1 failure path. When failing, fix the workflow first, not the test.

Run: `npm test`; coverage `npm run test:coverage`.
