# tests/utils/ — \_utils Security Helper Tests

- Covers `worker/api/_utils`: `body-limits` (max body enforcement) and `rate-limit` (fixed-window per IP; fail-open without `MBTI_KV`; 429 over limit).
- Assert the exact limit/window constants and the fail-open branch.

Run: `npm test`.
