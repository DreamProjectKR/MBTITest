# worker/infrastructure/repositories/ — Storage Repositories

- Subfolders by store: `d1/` (metadata), `r2/` (body + assets), `kv/` (detail cache).
- Each repository takes its binding as an argument and does one store's I/O only. No orchestration or business rules.

Verify: `npm test` (`tests/infrastructure/`).
