# scripts/ — Build & Data Tooling

Standalone Node (CJS/MJS) and one Python helper. Not part of the Worker bundle.

## Scripts

- `generate_d1_seed.cjs` → `npm run seed:generate`: builds `seed/d1_seed_from_assets.sql` from assets.
- `normalize_test_json.cjs`: normalize test JSON to the canonical shape (questions/results, `assets/...` paths).
- `verify-dreamp.mjs` → `npm run verify:dreamp`: live `dreamp.org` verification.
- `fetch_comments.py`: standalone Python helper.

## Contracts

- Keep scripts idempotent and parameterized; never hardcode secrets.
- D1 remote operations use the real `database_id` from `worker/wrangler.toml`, never a placeholder.
- Production verification scripts run against the live zone only AFTER a deploy; don't use pre-deploy output as evidence.
- Match canonical asset-key rules from `worker/domain/tests/assetKeys.ts` when generating/normalizing data; don't fork path logic.

## Verify

- Run the script and diff its output before committing generated files (e.g. the seed SQL).
