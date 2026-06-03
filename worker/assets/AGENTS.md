# worker/assets/ — R2 Asset Proxy

- `handler.ts` `handleAssetsGet`: serves `/assets/*` from R2 with Cache-Tag (`assets`, `test-{testId}`), ETag/304, Range, and legacy-key fallback.
- Avoid duplicate R2 lookups for the same key in one request. Use long edge cache + purgeable tags.
- Asset keys are canonical `assets/...`; reuse `domain/tests/assetKeys.ts`, don't re-derive paths.

Verify: `npm test` (`tests/assets-proxy/`).
