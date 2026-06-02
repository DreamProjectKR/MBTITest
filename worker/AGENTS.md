# worker/ — API + Asset Worker (TypeScript)

Cloudflare Worker that serves `/api/*` and `/assets/*`. Read `docs/ARCHITECTURE_CONSTRAINTS.md` before changing layering.

## Layering (depend downward only)

`http → application → domain → infrastructure`

- `http/` — request parse, response, status, headers, route registry, tiered-cache (`dispatch.ts`, `routes.ts`).
- `api/` — thin route handlers (`onRequestGet/Post/Put`); public `api/tests/*`, admin `api/admin/*`, shared `api/_utils/*`.
- `application/` — usecase orchestration: `queries/`, `workflows/`, `cache/`.
- `domain/` — pure rules: validation, asset key/path normalize, payload merge, MBTI compute. No I/O.
- `infrastructure/` — D1 / R2 / KV / Cache access (`repositories/*`).
- `assets/` — R2 asset proxy (`handler.ts`): Cache-Tag, ETag, Range, legacy key fallback.
- `_types.ts` — shared types (`MbtiEnv`, `PagesContext`, `KVNamespace`). Don't widen handler env assumptions beyond `MbtiEnv`.

## Operational Contracts

- Entry `index.ts` only delegates to `http/dispatch.ts` `dispatchWorkerRequest`; keep it trivial.
- `dispatchWorkerRequest` must `await` handlers so rejections become JSON 500 (regression-guarded). Never return an un-awaited handler promise.
- Add a route only in `http/routes.ts` `routeDescriptors` (match + methods + `tieredCache`). `matchRoute` is generic — don't fork parse logic. Update routing tests.
- Tiered cache fills via the `SELF` service binding (origin subrequest tagged `X-Mbti-Origin-Request`); only `GET` routes with a `tieredCache` descriptor use it.
- Mutations follow: validate → write body/assets (R2) → write metadata (D1) → invalidate caches → compensate on failure. Keep rollback in `application/`, not handlers.
- Errors: return `{ error: string }` JSON with 400 / 404 / 500; never leak stack traces (dispatch logs the stack server-side only).
- Check each `context.env` binding before use; throw/return JSON 500 with a clear message if missing.

## Runtime / Boundaries

- Runs on the Workers runtime, not Node. `nodejs_compat` is not enabled — don't import Node built-ins.
- Tests run via `node --experimental-strip-types`: types are stripped, not type-checked. There is no `typecheck` script.
- Bindings and zone routes live in `worker/wrangler.toml` (worker `mbtitest-api`, real D1 `database_id`). Don't deploy/migrate with placeholder ids.

## Verify

- `npm test` / `npm run test:coverage`; local run `npm run dev`.
