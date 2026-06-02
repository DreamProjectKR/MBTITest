# worker/domain/ — Pure Rules

Pure functions only: same input → same output. No I/O, no `env`, no `fetch`, no D1/R2/KV/Cache, no clock/random unless passed in.

## Contracts

- Holds: payload validation, asset path/key normalization, payload merge, MBTI compute, list payload shaping (`tests/*`).
- The canonical asset-path rule (`assets/...`) is defined ONCE here; workflows and handlers reuse it. Don't re-implement normalization elsewhere.
- Keep functions small; return new objects (immutable transforms), don't mutate inputs.
- Validation returns an error value/string; it does not throw I/O or build `Response` objects.

## Verify

- Fast unit tests in `tests/domain/` — cover branches directly here (cheapest coverage); push edge cases down to domain rather than into handlers.
- `npm test`; target `tests/domain/*`.
