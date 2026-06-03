# worker/api/admin/tests/ — Admin Test CRUD

- `index.ts`: `GET /api/admin/tests` → draft + published.
- `[id].ts`: `GET /api/admin/tests/:id` (draft + published) and `PUT` → `application/workflows/saveTest`.
- Handlers stay thin; validation / persistence / compensation live in the workflow + domain.

Verify: `npm test` (`tests/admin-authoring/`, `tests/api/admin-test-id-method`).
