# worker/api/admin/ — Admin Endpoints

- Admin API returns draft + published and owns mutations. Subfolders: `tests/` (CRUD + images), `utils/` (D1/R2 helpers).
- Keep external admin contracts stable even when internals change. Mutations are `no-store` and invalidate caches via `application/`.
- Admin exposure is controlled by crawl/search suppression + Cloudflare Access (`docs/ADMIN_ACCESS.md`), not in-Worker auth.

Verify: `npm test` (`tests/admin-*`, `tests/api/admin-*`).
