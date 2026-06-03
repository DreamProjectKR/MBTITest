# tests/infrastructure/ — Repository Tests

- Covers D1 metadata/image repositories, R2 test-body repository, KV detail + index cache repositories (`d1-*`, `r2-*`, `test-detail-cache-*`, `test-index-cache-*`).
- Assert parameterized binds, key shapes (`assets/<id>/test.json`, `test:<id>`), and list-metadata branches. Use shared db/bucket stubs.
- KV cache is disposable; assert reads/writes, not durability.

Run: `npm test`.
