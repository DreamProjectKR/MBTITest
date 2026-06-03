# worker/api/tests/[id]/ — Compute Endpoint

- `compute.ts`: `POST /api/tests/:id/compute` → MBTI calc via `domain/tests/computeMbti`.
- Enforce body limit + rate limit (`_utils`); response is `no-store` (no caching).
- Keep the calculation in domain; the handler only parses answers and returns percentages.

Verify: `npm test` (`tests/api/compute-*`).
