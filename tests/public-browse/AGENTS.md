# tests/public-browse/ — Public Visibility Tests

- Covers publication policy (`publication`): `GET /api/tests` and `/api/tests/:id` return only `isPublished` tests; draft → 404.
- Assert the public/admin visibility contract from `docs/ARCHITECTURE_CONSTRAINTS.md`.

Run: `npm test`.
