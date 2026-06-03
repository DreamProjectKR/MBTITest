# worker/api/admin/tests/[id]/ — Admin Image Upload

- `images.ts`: `GET` lists images; `PUT /api/admin/tests/:id/images` uploads via `application/workflows/uploadTestImage`.
- Reject SVG; enforce body limit + rate limit. Per-MBTI result images live under `results/[mbti]/`.
- Keep D1 meta + R2 binary consistent (the workflow handles ordering/compensation).

Verify: `npm test` (`tests/admin-images/`, `tests/api/admin-images-*`).
