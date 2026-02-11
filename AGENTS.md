# AGENTS.md — AI Context for MBTI ZOO

This file is the **primary context for AI assistants** (e.g. Cursor, Copilot) working on this codebase. When editing this repo, follow the guidelines below so changes stay consistent, performant, and maintainable.

## Core Conventions

- Prefer small, pure functions; immutable data where possible; explicit types; no side effects in shared helpers.
- When in doubt: match existing patterns in `functions/` and `public/scripts/`; link to docs for architecture.
- See [docs/README.md](docs/README.md) for architecture and data flow.

---

## Sub-Agents, MCP, and Skills

- **Sub-agents**: Delegate complex tasks (e.g. testing, debugging, verification) to specialized agents when available (e.g. `.cursor/agents/`).
- **MCP (Model Context Protocol)**: Use MCP tools when applicable—browser for E2E testing, Context7 for up-to-date docs, shadcn for components—instead of reimplementing.
- **Skills**: Leverage available skills for workflows (e.g. `create-rule`, `create-skill`, `skill-installer`) to follow established patterns and extend capabilities.
- Check available tools and skills first; prefer using them over ad-hoc solutions.

---

## Project Stack

Cloudflare Pages + Functions, D1 (SQLite), R2 (object storage), KV (cache). Frontend: HTML/CSS/JS (no framework). API handlers in TypeScript under `functions/api/`.

- Architecture: [docs/README.md](docs/README.md)
- API reference: [docs/API.md](docs/API.md)
- Performance: [docs/CLOUDFLARE_PERFORMANCE.md](docs/CLOUDFLARE_PERFORMANCE.md)
- Cloudflare 무료/유료 설정: [docs/cloudflare_online.md](docs/cloudflare_online.md)
- 성능·유지보수 계획: [docs/PERFORMANCE_MAINTENANCE_PLAN.md](docs/PERFORMANCE_MAINTENANCE_PLAN.md)

---

## Cloudflare Best Practices

### Bindings

- Use `context.env` (mbti_db, MBTI_BUCKET, MBTI_KV). Never assume bindings exist.
- Check before use; return 500 with a clear message if missing:
  ```ts
  if (!context.env.mbti_db)
    return json({ error: "D1 binding mbti_db is missing." }, 500);
  ```

### Edge and Caching

- Use Cache API by URL for purgeability; avoid ETag-only cache keys when purge is needed.
- Set `Cache-Control`, `Vary: Accept-Encoding`, and `stale-if-error` for API responses.
- Mutations: `Cache-Control: no-store`; invalidate KV + Cache API on save (see `functions/api/admin/tests/[id].ts`).
- Details: [docs/CLOUDFLARE_PERFORMANCE.md](docs/CLOUDFLARE_PERFORMANCE.md)

### D1

- Use parameterized queries only: `.bind(...)`.
- Keep queries in handlers or a thin data layer (e.g. `functions/api/admin/utils/store.ts`).
- Avoid N+1; prefer batch or single queries.

### R2

- Use existing key patterns: `assets/${testId}/test.json`, `assets/${testId}/images/...`.
- Be consistent with stream vs buffer; see `functions/assets/[[path]].ts` and `writeTest` in store.ts.

### Errors

- Return JSON `{ error: string }` with appropriate status (400, 404, 500).
- Do not leak stack traces or internals to clients.

---

## Performance and Logic Optimization

### APIs

- Read from KV or Cache API before D1/R2.
- Write-through on mutation with invalidation (KV delete + `cache.delete()`).
- Use ETag for 304 where applicable.
- Keep handlers short; delegate to helpers.

### Assets

- Serve via `functions/assets/[[path]].ts`.
- Set Cache-Tag for purge (`assets`, `test-{testId}`).
- Avoid duplicate R2 lookups for the same key in one request.

### Frontend

- Prefer declarative updates and single source of truth (e.g. `public/scripts/admin/state.js`).
- Batch DOM updates; avoid unnecessary reflows.
- Keep state in one place; avoid scattered flags.

### Idiom

- Prefer early returns; avoid deep nesting.
- Keep functions small (under ~50 lines).

---

## SOLID Principles

### S (Single Responsibility)

- One handler per route; shared logic in `_utils` or `utils`.
- Example: `functions/api/_utils/http.ts` for headers; `functions/api/admin/utils/store.ts` for D1/R2.

### O (Open/Closed)

- Extend via new Functions or new exports in utils instead of editing core request flow.
- Keep validation and serialization in dedicated functions.

### L (Liskov)

- Substitutes (e.g. different env bindings in tests) should preserve contract.
- Handlers should not assume a specific env shape beyond `MbtiEnv`.

### I (Interface Segregation)

- Types in `functions/_types.ts` (e.g. `MbtiEnv`, `PagesContext`).
- Payload types local to handlers; avoid fat request/response types.

### D (Dependency Inversion)

- Handlers depend on `context.env` and `context.request`.
- Avoid global state and hardcoded origins.
- Use `new URL(context.request.url)` for base URL.

---

## Functional Programming Guidelines

### Pure Helpers

- Validation, parsing, and header building should be pure (same input → same output; no I/O).
- Examples: `withCacheHeaders`, `parseJsonArray`, `cacheControlForKey` in existing code.

### Immutability

- Do not mutate request/response objects or shared state.
- Copy when needed: `new Headers(cached.headers)`.

### Composition

- Prefer small functions composed in handlers: read → validate → merge → respond.
- Avoid one big procedure.

### Side Effects at Boundaries

- I/O (D1, R2, KV, Cache API, `context.waitUntil`) only in handlers or explicitly named functions (e.g. `writeTest`, `upsertTestImageMeta`).
- Keep them easy to spot.

---

## File and Naming Conventions

| Area         | Path                                 |
| ------------ | ------------------------------------ |
| API handlers | `functions/api/`                     |
| Asset proxy  | `functions/assets/[[path]].ts`       |
| Shared types | `functions/_types.ts`                |
| HTTP utils   | `functions/api/_utils/http.ts`       |
| Admin utils  | `functions/api/admin/utils/store.ts` |

- Naming: `onRequestGet` / `onRequestPut`; camelCase for functions and variables; kebab-case for routes and static assets.
- Admin endpoints: all under `functions/api/admin/`; use `store.ts` for D1/R2 helpers.

---

## Testing and Safety

- Before changing behavior: run `npm run format`, `npm run build` (if applicable), and any project tests.
- When adding APIs or env bindings: update `docs/API.md` or `docs/README.md` and `wrangler.toml` if needed.
- Prefer minimal, backward-compatible changes; document breaking changes in commit or PR.

---

## Quick Reference

| Task                     | Location                             |
| ------------------------ | ------------------------------------ |
| Change API cache headers | `functions/api/_utils/http.ts`       |
| Add admin mutation       | `functions/api/admin/tests/...`      |
| Asset cache policy       | `functions/assets/[[path]].ts`       |
| D1/R2 helpers            | `functions/api/admin/utils/store.ts` |
| Shared types             | `functions/_types.ts`                |
| Caching strategy         | `docs/CLOUDFLARE_PERFORMANCE.md`     |
