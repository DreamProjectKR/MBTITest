# worker/application/queries/ — Read Models

- `listPublishedTests`, `listAdminTests`, `getTestDetailBase`, `getPublicTestDetail`, `getAdminTestDetail`.
- Read-only orchestration: KV → D1 + R2 merge. No mutations, no cache invalidation here.
- Public queries enforce `isPublished`; admin queries return draft + published.

Verify: `npm test` (`tests/application/`, `tests/api/`).
