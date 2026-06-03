# worker/api/\_utils/ — Shared HTTP Helpers (pure)

- `http.ts`: header / JSON / no-store response builders, cache headers. `bodyLimits.ts`: max body size. `rateLimit.ts`: `rateLimitOr429` (fixed-window per IP).
- Keep these pure/deterministic; no usecase logic. `rateLimitOr429` is fail-open when `MBTI_KV` is missing (local dev).
- Reuse across handlers; don't inline duplicate header/limit logic.

Verify: `npm test` (`tests/utils/`, `tests/api/http-utils-branches`).
