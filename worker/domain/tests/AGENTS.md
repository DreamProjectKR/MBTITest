# worker/domain/tests/ — Pure Test Rules

- `validation` (payload + `normalizeQuestions`/`normalizeResults`), `assetKeys` (canonical `assets/...`, `normalizeAssetKey`/`normalizeAssetPath`, `formatIndexDate`), `mergePayload`, `computeMbti`, `listPayload`.
- Pure only: no I/O, no `env`. Asset-path normalization is defined ONCE here; everyone reuses it.
- Return new objects; keep functions small and branch-covered.

Verify: `npm test` (`tests/domain/`).
