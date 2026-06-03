# tests/assets-proxy/ — R2 Asset Proxy Tests

- Covers `handleAssetsGet`: cache policy, Cache-Tag, ETag/304, Range, legacy-key fallback, and all-remote-fail path (`try-fetch-remote-all-fail`).
- Stub R2 + Cache API via shared harness; assert headers (Cache-Tag `assets` / `test-{id}`) and fallback order.

Run: `npm test`.
