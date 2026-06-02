# docs/ — Design Docs (contracts)

Source of truth for contracts and history. These are constraint docs, not narration.

## Read Priority (docs/README.md)

1. `ARCHITECTURE_CONSTRAINTS.md` — layering, boundaries, mutation/cache rules.
2. `WORKFLOW_SPECS.md` — public / admin / save / upload / asset flows.
3. `API.md` — HTTP contract and response policy.
4. `ERD.md` — D1 / R2 / KV ownership and storage shape.
5. `TEST_STRATEGY.md` — test layers + coverage policy.
6. `ADMIN_ACCESS.md` — protecting admin without app signup (Cloudflare Access).

## Contracts

- When a code change alters a contract, update the matching doc AND the path map in `docs/README.md` in the same change.
- Docs hold the official contract and history; keep short next-session task knowledge in folder `AGENTS.md` (separate concerns).
- Don't assert volatile facts (provider / model / pricing) as settled; verify against official sources.
- Image performance: `Result.md` (measurement) → `Solution.md` (ordered fixes); `CLOUDFLARE_PERFORMANCE.md` + `PERFORMANCE_MAINTENANCE_PLAN.md` for caching/perf.

## Verify

- `npm run format` covers `*.md`. Keep links relative and valid.
