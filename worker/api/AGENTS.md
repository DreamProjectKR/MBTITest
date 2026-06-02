# worker/api/ — Route Handlers (HTTP layer)

Thin handlers only. They parse the request, call one `application/` query or workflow, and build the `Response`. No D1/R2/KV orchestration here.

## Contracts

- Naming: `onRequestGet` / `onRequestPost` / `onRequestPut`. Register every handler in `worker/http/routes.ts`.
- Public (`api/tests/*`) returns only `isPublished = true` tests; draft → `404`. Admin (`api/admin/*`) returns draft + published.
- Keep admin mutation external contracts stable even when internals change.
- Shared helpers in `api/_utils/`: `http.ts` (headers, JSON responses, cache headers), `bodyLimits.ts` (max body size), `rateLimit.ts`. Admin D1/R2 helpers in `api/admin/utils/store.ts`.
- Build responses from helpers; set `Cache-Control: no-store` on mutations and error JSON.

## Security (see docs/TEST_STRATEGY.md)

- `rateLimitOr429` is fail-open when `MBTI_KV` is missing (local dev) — a missing 429 locally is not a bug; ensure `MBTI_KV` is bound in prod.
- compute / image PUT endpoints enforce body limit + rate limit + content-type; reject SVG for image uploads.
- Derive client IP from `cf-connecting-ip` then `x-forwarded-for`; never trust request body for identity.

## Verify

- New route/handler → add a success + failure regression test under `tests/api/` and update `tests/routing/`.
- `npm test`; for branch coverage of a handler, target its `tests/api/*` file.
