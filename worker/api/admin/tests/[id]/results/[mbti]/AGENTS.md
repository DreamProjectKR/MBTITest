# worker/api/admin/tests/[id]/results/[mbti]/ — Result Image Handler

- `image.ts`: `PUT /api/admin/tests/:id/results/:mbti/image` → `application/workflows/uploadResultImage` for one MBTI type.
- Validate `:mbti`; reject SVG; enforce body + rate limits. Invalidate the test's caches on success.

Verify: `npm test` (`tests/workflows/upload-result-image-*`, `tests/api/result-image-handler-branches`).
