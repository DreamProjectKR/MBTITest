# tests/domain/ — Pure Domain Rule Tests

- Covers pure helpers: assetKeys, computeMbti, listPayload, merge (payload/list/tags), validation, safe-json.
- No I/O, no harness — call functions directly. Cheapest place to cover branches; push edge cases here rather than into handlers.

Run: `npm test`; target `tests/domain/*` for fast feedback.
