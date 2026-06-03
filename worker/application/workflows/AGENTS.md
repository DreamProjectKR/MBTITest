# worker/application/workflows/ — Mutations

- `saveTest`, `uploadTestImage`, `uploadResultImage`.
- Hard order: validate → write body/assets (R2) → write metadata (D1) → invalidate caches → compensate on failure. Compensation lives here (e.g. restore/delete the previous R2 body if the D1 upsert throws).
- Check bindings at entry; throw clear/typed errors (handler maps to 400/500).

Verify: `npm test` (`tests/workflows/`, `tests/admin-authoring/`).
